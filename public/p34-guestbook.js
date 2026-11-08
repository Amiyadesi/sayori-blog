export const LETTER_ENDPOINT = 'https://comments.sayori.org/';
export const LETTER_PATH = '/project-34/guestbook/';
const DRAFT_KEY = 'p34-local-letter';
const escapeHTML = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function letterPayload({ name, mail, text }, href, token, userAgent) {
  if (typeof name !== 'string' || !name.trim() || name.length > 40) throw new Error('请填写称呼，最多 40 字');
  if (typeof mail !== 'string' || mail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error('请填写有效邮箱，邮箱不会公开');
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) throw new Error('留言需要 1–1000 字');
  return { event: 'COMMENT_SUBMIT', url: LETTER_PATH, href, nick: name.trim(), mail: mail.trim(), ua: userAgent,
    comment: `<p>${escapeHTML(text.trim()).replace(/\r?\n/g, '<br>')}</p>`, turnstileToken: token };
}

export async function letterRequest(payload, signal) {
  const response = await fetch(LETTER_ENDPOINT, { method: 'POST', credentials: 'omit',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
  if (!response.ok) throw new Error(`留言服务暂时不可用（${response.status}）`);
  const result = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('留言服务返回格式有误');
  if (result.code) throw new Error(typeof result.message === 'string' ? result.message : '留言服务拒绝了请求');
  if (payload.event === 'COMMENT_SUBMIT' && (typeof result.id !== 'string' || !result.id)) throw new Error('服务器没有确认收到，文字仍在');
  return result;
}

let turnstileLoad;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileLoad) turnstileLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = resolve;
    script.onerror = () => { script.remove(); turnstileLoad = null; reject(new Error('验证组件没能加载，请重试')); };
    document.head.append(script);
  });
  return turnstileLoad;
}

export function mountGuestbook(panel, { signal, onSent }) {
  const form = panel.querySelector('form'), name = form.elements.name, mail = form.elements.mail, message = form.elements.message;
  const submit = form.querySelector('[type=submit]'), note = panel.querySelector('[data-letter-status]');
  const list = panel.querySelector('[data-letters]'), more = panel.querySelector('[data-letter-more]');
  const status = panel.querySelector('[data-letter-list-status]'), retry = panel.querySelector('[data-letter-refresh]');
  const listen = (el, event, fn) => el.addEventListener(event, fn, { signal });
  let ready = false, loading = false, sending = false, accessToken, token = '', widget, captcha = false;
  let before, legacyDraft = false;
  const updateSubmit = () => {
    submit.disabled = sending || !ready || captcha && !token;
    for (const field of [name, mail, message]) field.readOnly = sending;
  };
  const explain = error => error.name === 'TimeoutError' ? '网络超时，请重试；文字仍在' : error.message || '网络连接失败，请重试；文字仍在';

  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const old = JSON.parse(raw);
      if (!old || typeof old.name !== 'string' || typeof old.text !== 'string' || old.name.length > 40 || old.text.length > 1000) throw new Error('旧留言格式有误，原记录未改动');
      name.value = old.name; message.value = old.text; legacyDraft = true;
      note.textContent = '这是原设备里的草稿，尚未发布';
      form.querySelector('[data-count]').textContent = `${message.value.length} / 1000`;
    }
  } catch (error) { note.textContent = explain(error); }

  async function loadLetters(append = false) {
    const result = await letterRequest({ event: 'COMMENT_GET', url: LETTER_PATH, sort: 'newest',
      ...(append ? { before } : {}), accessToken }, signal);
    if (signal.aborted) return;
    if (!Array.isArray(result.data) || result.data.some(item => !item || typeof item.nick !== 'string' || typeof item.comment !== 'string' || !Number.isFinite(item.created) || item.created < 0 || item.created > 8640000000000000)) throw new Error('留言列表格式有误');
    accessToken = result.accessToken || accessToken;
    if (!append) list.replaceChildren();
    for (const item of result.data) {
      const row = document.createElement('li'), author = document.createElement('strong'), time = document.createElement('time'), body = document.createElement('p');
      author.textContent = item.nick;
      time.dateTime = new Date(item.created).toISOString();
      time.textContent = new Date(item.created).toLocaleDateString('zh-CN');
      const plain = document.createElement('template');
      plain.innerHTML = item.comment.replace(/<br\s*\/?\s*>/gi, '\n');
      body.textContent = plain.content.textContent;
      row.append(author, time, body); list.append(row);
    }
    before = result.data.length ? Math.min(...result.data.map(item => item.created)) : undefined;
    more.hidden = !result.more || before === undefined;
    status.textContent = list.children.length ? '' : '还没有公开留言';
  }

  async function open() {
    if (loading) return;
    loading = true; retry.disabled = true; more.disabled = true; status.textContent = '正在读取留言';
    try {
      await loadLetters();
      if (!ready) {
        const result = await letterRequest({ event: 'GET_CONFIG' }, signal);
        if (signal.aborted) return;
        const config = result.config;
        if (!config || typeof config !== 'object') throw new Error('留言配置无法读取');
        accessToken = result.accessToken || accessToken;
        if (config.CAPTCHA_PROVIDER && config.CAPTCHA_PROVIDER !== 'Turnstile') throw new Error('留言服务的验证方式已更换，需要更新页面');
        captcha = config.CAPTCHA_PROVIDER === 'Turnstile';
        if (captcha) {
          if (!config.TURNSTILE_SITE_KEY) throw new Error('留言服务缺少验证配置');
          await loadTurnstile();
          if (signal.aborted) return;
          widget = window.turnstile.render(panel.querySelector('[data-letter-captcha]'), {
            sitekey: config.TURNSTILE_SITE_KEY, theme: 'dark', size: 'flexible', appearance: 'interaction-only', retry: 'never',
            callback(value) { token = value; updateSubmit(); },
            'expired-callback'() { token = ''; updateSubmit(); },
            'error-callback'(code) {
              token = ''; note.textContent = String(code) === '110200' ? '当前地址尚未获准使用留言验证，请作者开通此域名' : `验证未完成（${code}），请重试`;
              updateSubmit(); return true;
            },
          });
        }
        ready = true; updateSubmit();
      }
    } catch (error) { if (!signal.aborted) status.textContent = explain(error); }
    finally { loading = false; retry.disabled = false; more.disabled = false; }
  }

  listen(retry, 'click', () => { if (widget !== undefined) window.turnstile.reset(widget); void open(); });
  listen(more, 'click', async () => {
    if (loading) return;
    loading = true; more.disabled = true; retry.disabled = true;
    try { await loadLetters(true); } catch (error) { if (!signal.aborted) status.textContent = explain(error); }
    finally { loading = false; more.disabled = false; retry.disabled = false; }
  });
  listen(form, 'submit', async event => {
    event.preventDefault();
    if (sending || !ready) return;
    if (captcha && !token) { note.textContent = '请先完成验证'; return; }
    let payload;
    try { payload = letterPayload({ name: name.value, mail: mail.value, text: message.value }, location.href, token, navigator.userAgent); }
    catch (error) { note.textContent = error.message; return; }
    sending = true; updateSubmit(); note.textContent = '正在发送';
    try {
      const result = await letterRequest({ ...payload, accessToken }, signal);
      if (signal.aborted) return;
      accessToken = result.accessToken || accessToken;
      message.value = ''; form.querySelector('[data-count]').textContent = '0 / 1000';
      note.textContent = '已送达，审核通过后会出现在这里';
      if (legacyDraft) {
        try { localStorage.removeItem(DRAFT_KEY); legacyDraft = false; }
        catch { note.textContent += '；旧设备草稿未能清除'; }
      }
      onSent();
      try { await loadLetters(); }
      catch { status.textContent = '留言已送达，列表暂时没能刷新'; }
    } catch (error) { if (!signal.aborted) note.textContent = explain(error); }
    finally {
      sending = false; token = '';
      if (!signal.aborted && widget !== undefined) window.turnstile.reset(widget);
      updateSubmit();
    }
  });
  signal.addEventListener('abort', () => { if (widget !== undefined) window.turnstile.remove(widget); }, { once: true });
  return { open };
}
