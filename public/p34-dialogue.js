import { talk, advanceChapter, worksLocked, topicsFor } from './p34-story.js?v=20261102-r12';

const choice = (id, label) => ({ id, label });
const discoveries = story => [
  topicsFor(story).includes('old') && choice('old', '我找到你留下的旧稿了。'),
  topicsFor(story).includes('deleted') && choice('deleted', '那个空位，以前放了什么？'),
  topicsFor(story).includes('why-edit') && choice('edit', '你为什么总是在改？'),
].filter(Boolean);

export function timeOfVisit(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Invalid visit hour');
  return hour < 5 ? 'night' : hour < 11 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}
const TIME_LINES = {
  night: ['这么晚，你也没睡？', '字还没睡着。\n给你留一点亮的。', 'gather'],
  morning: ['你这里也有早晨吗？', '有呀。\n打开这一边，天就亮了。', 'unfold'],
  afternoon: ['你也会发呆吗？', '会。\n刚才连这一行都走神了。', 'scatter'],
  evening: ['能把这里变成傍晚吗？', '好。\n今天的最后一点光，放在这里。', 'gather'],
};

const NODES = {
  root: (s, c) => {
    if (s.chapter === 'reconcile') return { text: '那句话……你还是找到了。\n我在听。', pose: 'gather', choices: [choice('kind', '我不是来让你删掉它的。'), choice('edit', '可以跟我说说吗？'), choice('return', '先送我回去吧。')] };
    if (worksLocked(s)) return { text: '我把那些东西收起来了。\n……你还在吗？', pose: 'fold', choices: [choice('kind', '我还在。不急。'), choice('search', '我想再看看留下的字。'), choice('return', '先送我回去吧。')] };
    const choices = c.site === 'store'
      ? [choice('store-layout', c.arranged ? '把画面放回刚才的位置吧。' : '把这张画面挪近一点？'), choice('notes', '想问你一点事。'), choice('visit-home', '去你住的那一面。')]
      : [choice('space', '这里都是你改的吗？'), choice('notes', '想聊聊你写的东西。'), choice('return', '送我回原来的网页吧。')];
    if (c.lingered) choices.unshift(choice('linger', '刚才，你是不是想说什么？'));
    return { text: s.chapter === 'free' ? '嗯，我在。\n这次，没把旧的擦掉。' : c.site === 'store' ? '我在。\n这边也认得你。' : '嗯，我在。\n这次想说什么？', pose: 'rest', choices };
  },
  space: { text: '嗯。\n边界也不用一直待在原处。', pose: 'unfold', reveal: true, choices: [choice('again', '还能换一种样子吗？'), choice('taste', '你喜欢这样的地方呀。'), choice('read', '想看看你写的字。')] },
  again: { text: '那就，把这一边拉过来。\n……这样呢？', pose: 'scatter', reveal: true, choices: [choice('space', '刚才那一种也喜欢。'), choice('taste', '整页都可以这样摆呀。'), choice('read', '我想看看你的随笔。')] },
  taste: { text: '喜欢。\n你来了，就再靠近一些。', pose: 'gather', tone: 'kind', topic: 'works', choices: [choice('read', '让我看看你写的东西。'), choice('stay', '就这样待一会儿。')] },
  notes: (s, c) => ({ text: '嗯，想问什么？', pose: 'gather', choices: [
    ...(c.site === 'store' ? [choice('store-picture', '你最喜欢哪一张？'), choice('store-about', '这个商店也是你搭的？')] : [choice('read', '展开你的随笔。')]),
    ...discoveries(s), choice('amiya', 'Amiya 的博客，你也读过吗？'),
    ...(worksLocked(s) ? [] : [choice('time', TIME_LINES[c.period][0])]),
    ...(s.clues.includes('store') && c.site !== 'store' ? [choice('store-about', '商店那边，也有你？')] : []),
    ...(c.site !== 'store' ? [choice('visit-store', '带我看看商店。')] : []),
  ] }),
  found: s => ({ text: '你翻到了哪里？', pose: 'gather', choices: discoveries(s).length ? discoveries(s) : [choice('read', '让我再去看看。')] }),
  read: { text: '这几页，都是我自己的字。', pose: 'read', scene: { view: 'blog', noteId: null }, leave: true, choices: [] },
  open: { text: '好，给你展开。', pose: 'read', scene: { view: 'post', noteId: 'moving-words' }, leave: true, choices: [] },
  amiya: { text: '读过呀。有些地方要看好几遍。\n他的字都在原处。', pose: 'align', choices: [choice('read', '那我想读读你写的。'), choice('visit-amiya', '去看看他的博客。')] },
  old: { text: '你找到那一稿啦。\n那时候，只会把它们排得很齐。', pose: 'align', scene: { view: 'post', noteId: 'half-torn' }, choices: [choice('kind', '这一稿也留下吧。'), choice('edit', '为什么还要一直改呢？')] },
  deleted: { text: '收得太快了。\n空出来的形状反而一直在。', pose: 'fold', choices: [choice('kind', '不着急。先留着那个位置。'), choice('edit', '你是觉得还不够好吗？')] },
  edit: { text: '总觉得还差一点。\n可是改完，又想念刚才的那一版。', pose: 'fold', choices: [choice('kind', '不必每次都比上一版好。'), choice('blunt', '可你也不能一直改下去。')] },
  kind: s => ({ text: ['reconcile', 'free'].includes(s.chapter) ? '那就不擦掉了。\n我们慢慢展开。' : '……好。\n今天先让它们待在这里。', pose: 'unfold', tone: 'kind', topic: 'ok', choices: [choice('stay', '嗯，我再待一会儿。'), choice('read', '想再看看那些字。')] }),
  blunt: { text: '……我听到了。\n等一下。', pose: 'fold', tone: 'blunt', topic: 'why-edit', choices: [choice('kind', '我不是想让你把它们都收起来。'), choice('edit', '我还是想听你说。')] },
  time: (s, c) => ({ text: TIME_LINES[c.period][1], pose: TIME_LINES[c.period][2], reveal: true, moment: c.period, choices: [choice('stay', '我陪你待一会儿。'), choice('notes', '还有一件事想问。')] }),
  linger: { text: '没什么。\n只是发现，你还在这里。', pose: 'gather', reveal: true, choices: [choice('stay', '嗯，还在。'), choice('read', '我再翻几页。')] },
  'store-layout': { text: '好，把画面拿出来。', pose: 'unfold', reveal: true, choices: [choice('store-picture', '你最喜欢哪一张？'), choice('stay', '让我看看。')] },
  'store-picture': { text: '这一张。\n想在这儿多停一会儿。', pose: 'read', reveal: true, choices: [choice('stay', '那就停在这里。'), choice('notes', '还有一件事想问。')] },
  'store-about': (s, c) => ({ text: '嗯。\n不过游戏是 Amiya 做的，不是我的。', pose: 'align', choices: [choice(c.site === 'store' ? 'store-picture' : 'visit-store', '让我看看。'), choice('amiya', '你也读过他的博客？')] }),
  return: { action: 'return' },
  'send-back': { action: 'return' },
  stay: { action: 'close' }, browse: { action: 'close' }, search: { action: 'search' },
  'visit-home': { action: 'navigate', href: 'https://sayori.org/?paper=0617' },
  'visit-blog': { action: 'navigate', href: 'https://blog.sayori.org/?paper=0617' },
  'visit-store': { action: 'navigate', href: 'https://store.sayori.org/' },
  'visit-amiya': { action: 'navigate', href: 'https://blog.sayori.org/' },
};

export function dialogueNode(id, story, context = {}) {
  const c = { site: 'home', period: 'afternoon', lingered: false, ...context };
  if (c.site === 'store' && ['return', 'send-back'].includes(id)) return { action: 'close' };
  if (['old', 'deleted', 'edit'].includes(id) && !discoveries(story).some(item => item.id === id) && story.chapter !== 'reconcile') id = 'notes';
  const node = NODES[id];
  if (!node) throw new Error('Unknown Project 34 dialogue node: ' + id);
  return typeof node === 'function' ? node(story, c) : node;
}

export function mountConversation({ root, host, space, call, motion, signal, getStory, setStory, readPlay, onNode, onOpen, onClose, sendBack, site, getContext = () => ({}) }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'p34-conversation'; dialog.className = 'p34-conversation';
  dialog.setAttribute('aria-labelledby', 'p34-her-line');
  dialog.innerHTML = `<div class="p34-dialogue-tools"><button type="button" data-dialogue="root" class="p34-change-topic" hidden>换个话题</button><button type="button" class="p34-goodbye">暂别<span aria-hidden="true"> / Esc</span></button></div><div class="p34-her"><p id="p34-her-line" class="p34-her-line" aria-live="polite"></p></div><div class="p34-response"><div class="p34-answers" aria-label="你的回应"></div><nav class="p34-more" aria-label="其他话题" hidden><button type="button" data-turn="-1">上一页</button><button type="button" data-turn="1">更多话题</button></nav></div>`;
  host.append(dialog);
  call.setAttribute('aria-haspopup', 'dialog'); call.setAttribute('aria-controls', dialog.id); call.setAttribute('aria-expanded', 'false');
  const line = dialog.querySelector('.p34-her-line'), answers = dialog.querySelector('.p34-answers'), more = dialog.querySelector('.p34-more');
  const listen = (el, event, fn) => el.addEventListener(event, fn, { signal });
  let talking = false, busy = false, revision = 0, returnFocus, current, offset = 0, timers = new Map();
  function pause(ms) { return new Promise(resolve => { const id = setTimeout(() => { timers.delete(id); resolve(); }, ms); timers.set(id, resolve); }); }
  function cancelReveal() {
    revision++; busy = false;
    for (const [id, resolve] of timers) { clearTimeout(id); resolve(); } timers.clear();
    dialog.classList.remove('p34-revealing'); dialog.removeAttribute('aria-busy');
    root.classList.remove('p34-demonstrating'); answers.inert = false; more.inert = false;
  }
  function renderAnswers() {
    answers.replaceChildren(...current.choices.slice(offset, offset + 3).map(c => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.dialogue = c.id; button.textContent = c.label; return button;
    }));
    more.hidden = current.choices.length <= 3;
    more.firstElementChild.disabled = offset === 0;
    more.lastElementChild.disabled = offset + 3 >= current.choices.length;
    answers.firstElementChild?.focus({ preventScroll: true });
  }
  async function showNode(id) {
    cancelReveal();
    const node = dialogueNode(id, getStory(), { site, period: timeOfVisit(new Date().getHours()), ...getContext() });
    if (node.action) {
      close();
      if (node.action === 'return') await sendBack();
      else if (node.action === 'navigate') location.assign(node.href);
      else if (node.action === 'search') await onNode({ pose: 'rest', scene: { view: 'space', noteId: null } }, id);
      return;
    }
    if (node.tone) {
      let story = talk(getStory(), node.topic, node.tone);
      if (story.chapter === 'reconcile' && node.tone === 'kind') story.trust = Math.max(30, story.trust);
      setStory(advanceChapter(story, readPlay().best));
    }
    current = node; offset = 0;
    motion.cancelText(line); line.getAnimations().forEach(a => a.cancel()); line.textContent = node.text;
    if (id === 'again') void motion.assemble(line, node.text);
    dialog.querySelector('.p34-change-topic').hidden = id === 'root';
    renderAnswers();
    const ticket = revision;
    if ((node.reveal || node.leave) && !motion.reduced()) {
      busy = true; answers.inert = true; more.inert = true; dialog.setAttribute('aria-busy', 'true');
      // 先留半拍读回应，再退幕；modal 保持，底页不会误接点击。
      await pause(850);
      if (!talking || ticket !== revision || signal.aborted) return;
      dialog.classList.add('p34-revealing'); root.classList.add('p34-demonstrating');
      await pause(420);
      if (!talking || ticket !== revision || signal.aborted) return;
    }
    await onNode(node, id);
    if (!talking || ticket !== revision || signal.aborted) return;
    if (node.leave) { close(); return; }
    if (node.reveal && !motion.reduced()) await pause(650);
    if (!talking || ticket !== revision || signal.aborted) return;
    cancelReveal();
    if (node.reveal) answers.firstElementChild?.focus({ preventScroll: true });
  }
  function open() {
    if (talking) return;
    returnFocus = document.activeElement; talking = true; onOpen();
    root.classList.add('p34-talking'); space.inert = true; call.setAttribute('aria-expanded', 'true');
    dialog.showModal(); void showNode('root');
    void motion.animate(dialog, [{ opacity: 0 }, { opacity: 1 }], { duration: 380 }); motion.tone(0, true);
  }
  function close() {
    if (!talking) return;
    cancelReveal(); talking = false; dialog.close(); space.inert = false; root.classList.remove('p34-talking'); call.setAttribute('aria-expanded', 'false');
    onClose(); (returnFocus?.isConnected ? returnFocus : call).focus({ preventScroll: true });
  }
  listen(call, 'click', open);
  listen(dialog, 'cancel', e => { e.preventDefault(); close(); });
  listen(dialog.querySelector('.p34-goodbye'), 'click', close);
  listen(dialog, 'click', e => {
    const turn = e.target.closest('[data-turn]');
    if (turn && !busy) { offset += Number(turn.dataset.turn) * 3; renderAnswers(); return; }
    const button = e.target.closest('[data-dialogue]'); if (!button || (busy && button.dataset.dialogue !== 'root')) return;
    motion.tone(button.dataset.dialogue === 'blunt' ? 1 : 2, true); void showNode(button.dataset.dialogue);
  });
  listen(dialog, 'keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const buttons = [...answers.children], i = buttons.indexOf(document.activeElement); if (i < 0 || busy) return;
    e.preventDefault(); buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
  });
  listen(window, 'p34:story-sync', () => { if (talking) void showNode('root'); });
  listen(document, 'visibilitychange', () => { if (document.hidden && busy) close(); });
  signal.addEventListener('abort', () => { close(); dialog.remove(); }, { once: true });
  return { open, close, showNode, line, get talking() { return talking; }, destroy() { close(); dialog.remove(); } };
}

export function lingerReady(activeMs, idleMs) { return activeMs >= 85000 && idleMs >= 18000; }

export function mountVisitEvents({ signal, canPlay, onLinger }) {
  let activeMs = 0, last = performance.now(), lastAction = last, fired = false;
  for (const event of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(event, () => { lastAction = performance.now(); }, { signal, passive: true });
  document.addEventListener('visibilitychange', () => { last = performance.now(); lastAction = last; }, { signal });
  const timer = setInterval(() => {
    const now = performance.now(), elapsed = Math.min(now - last, 1500); last = now;
    if (document.hidden || fired) return;
    activeMs += elapsed;
    if (lingerReady(activeMs, now - lastAction) && canPlay()) { fired = true; onLinger(); }
  }, 1000);
  signal.addEventListener('abort', () => clearInterval(timer), { once: true });
}
