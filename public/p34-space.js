import { LINES } from './p34-script.js?v=20261108-revision';
import { createMotion } from './p34-motion.js?v=20261108-revision';
import { WORLD_COOKIE_KEY, advanceEncounterState, readWorldCookie, serializeWorldState, createWorldSession } from './p34-living.js?v=20261104-flow';
import { createLightSpace, INITIAL_LIGHT, readSketches } from './p34-light.js?v=20261108-revision';
import { capturePage, playPassage, cancelPassage } from './p34-passage.js?v=20261104-flow';
import { mountAdventure } from './p34-adventure.js?v=20261108-revision';

export const SKETCH_KEY = 'p34-light-sketches-v1';
export const ROOMS = ['home', 'works', 'lab', 'blog', 'archive', 'guestbook'];

export function roomFromURL(href, site = 'home') {
  const url = new URL(href, 'https://sayori.org/');
  if (site === 'blog') return 'blog';
  const room = url.searchParams.get('room') || 'home';
  return ROOMS.includes(room) && room !== 'blog' ? room : 'home';
}

export function roomHref(room, base = 'https://sayori.org/') {
  if (!ROOMS.includes(room)) throw new Error(`Unknown space: ${room}`);
  if (room === 'blog') return 'https://blog.sayori.org/?paper=0617';
  const url = new URL('/', base);
  url.searchParams.set('paper', '0617');
  if (room !== 'home') url.searchParams.set('room', room);
  return url.pathname + url.search;
}

const LABELS = { home: '这里', works: '作品', lab: '实验室', blog: '写的东西', archive: '旧稿', guestbook: '留言' };
const active = new WeakMap();
const cloneNodes = nodes => nodes.map(p => [...p]);

export async function mountSpace({ site = 'home', posts = [], isCurrent = () => true } = {}) {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  const style = document.querySelector('link[data-p34-reading-style], link[data-p34-space-style]') || document.createElement('link');
  const ownedStyle = !style.isConnected;
  if (!style.sheet) {
    await new Promise((resolve, reject) => {
      style.addEventListener('load', resolve, { once: true });
      style.addEventListener('error', () => reject(new Error('Space stylesheet failed to load')), { once: true });
      if (ownedStyle) {
        style.rel = 'stylesheet'; style.href = site === 'blog' ? '/p34-reading.css?v=20261108-revision' : '/p34-luminous.css?v=20261108-revision';
        style.dataset.p34SpaceStyle = ''; document.head.append(style);
      }
    });
  }
  if (!isCurrent() || new URLSearchParams(location.search).get('paper') !== '0617') {
    if (ownedStyle) style.remove();
    return () => {};
  }
  const html = document.documentElement;
  if (active.has(html)) return active.get(html);
  const controller = new AbortController(), { signal } = controller;
  const motion = createMotion(signal);
  const originalTitle = document.title, originalURL = location.href, originalScroll = scrollY;
  const normalState = history.state;
  const parked = [], timers = new Set();
  let leaving = false, disposed = false, room = roomFromURL(location.href, site), menu = false, talking = false;
  let articleOpen = false, articleRequest = 0, articleTransition = null, drag = null, dragCount = 0, lastRemark = -Infinity, nodes = cloneNodes(INITIAL_LIGHT), sketches = [];
  let revisionIndex = -1;
  const articleCache = new Map();
  const nativePost = document.querySelector('[data-p34-native-post]');
  if (nativePost) articleCache.set(nativePost.dataset.p34NativePost, nativePost.querySelector('.space-native-prose').cloneNode(true));
  let storageError = false;
  try { sketches = readSketches(localStorage.getItem(SKETCH_KEY)); } catch { storageError = true; }
  const { cookie, getStory, setStory } = createWorldSession();
  const visit = advanceEncounterState(readWorldCookie(document.cookie), site);
  cookie(WORLD_COOKIE_KEY, serializeWorldState(visit.state));
  const story = getStory();
  setStory({ ...story, met: 1, chapter: story.chapter === 'arrive' ? 'explore' : story.chapter });

  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id); return id;
  };
  // Mount and park the original page in one task, before the browser can paint it.
  html.classList.remove('p34-loading');
  const normalPage = capturePage();
  const sources = normalPage.words.map(word => ({ x: word.x, y: word.y, char: word.text[0] }));
  for (const el of [...document.body.children]) {
    if (['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName)) continue;
    const mark = document.createComment('p34:normal'); el.before(mark); el.remove(); parked.push([el, mark]);
  }
  html.classList.add('p34-spatial');
  html.dataset.p34Active = 'true'; html.dataset.p34Site = site;

  const shell = document.createElement('main');
  shell.id = 'p34-space'; shell.dataset.site = site; shell.dataset.room = room;
  shell.setAttribute('data-pagefind-ignore', 'all');
  shell.innerHTML = `
    <canvas class="space-light" aria-hidden="true"></canvas>
    <div class="space-mist" aria-hidden="true"></div>
    <a class="space-skip" href="#space-content">跳到内容</a>
    <section class="space-voice" aria-label="她说">
      <h1 id="space-voice-line" aria-live="polite" aria-atomic="true"></h1>
      <p class="space-under-voice"></p>
      <div class="space-tools">
        <button type="button" data-talk aria-expanded="false" aria-controls="space-replies">聊两句</button>
        <button type="button" data-map aria-expanded="false" aria-controls="space-paths">逛一圈</button>
        <button type="button" data-sound aria-label="开启声音" aria-pressed="false">♪</button>
        <button type="button" data-return hidden>回到原页</button>
      </div>
      <div id="space-replies" class="space-replies" hidden aria-label="你的回应"></div>
    </section>
    <nav id="space-paths" class="space-paths" aria-label="去哪里"></nav>
    <div id="space-content" class="space-content" tabindex="-1"></div>
    <span class="space-sr-only" data-status role="status"></span>`;
  document.body.append(shell); window.scrollTo(0, 0);
  const voice = shell.querySelector('h1'), under = shell.querySelector('.space-under-voice');
  const voicePlace = shell.querySelector('.space-voice');
  const replies = shell.querySelector('#space-replies'), nav = shell.querySelector('nav'), content = shell.querySelector('.space-content');
  const status = shell.querySelector('[data-status]');
  const light = createLightSpace(shell.querySelector('canvas'), { signal, reduced: motion.reduced });
  const panels = new Map();

  function speak(text, { mood = 'plain', note = null, animate = true, origins = null } = {}) {
    shell.dataset.expression = mood;
    if (note !== null) under.textContent = note;
    if (animate) void motion.assemble(voice, text, origins);
    else { motion.cancelText(voice); voice.textContent = text; }
  }
  function setStatus(text) { status.textContent = text; }

  for (const key of site === 'blog' ? ['home', 'blog'] : ROOMS) {
    const link = document.createElement('a');
    link.className = `space-path space-path-${key}`; link.dataset.roomLink = key;
    link.href = key === 'home' && site === 'blog' ? 'https://sayori.org/?paper=0617' : roomHref(key);
    link.textContent = key === 'home' && site === 'blog' ? '去她的空间' : LABELS[key];
    link.innerHTML += '<span class="space-orbit" aria-hidden="true"></span>';
    nav.append(link);
  }

  function addRoom(key, markup) {
    const panel = document.createElement('section'); panel.className = `space-room space-${key}`;
    panel.dataset.panel = key; panel.setAttribute('aria-label', LABELS[key]);
    panel.innerHTML = markup; content.append(panel); panels.set(key, panel); return panel;
  }

  if (site === 'home') {
    addRoom('home', `<button class="space-touch-light" data-touch-light type="button" aria-label="碰一下她正在调的光"><span aria-hidden="true"></span></button>`);
    addRoom('works', '<div class="space-work-caption"></div><button type="button" class="space-work-light" aria-label="玩打砖块"></button>');
    addRoom('lab', `<div class="space-rig" role="group" aria-label="拉住一束光，四个光点可拖动或用方向键移动">${INITIAL_LIGHT.map((_, i) => `<button type="button" class="space-node" data-node="${i}" aria-label="光点 ${i + 1}，方向键移动，Shift 加速"></button>`).join('')}</div><div class="space-lab-actions"><button type="button" data-save>留住这个形状</button><button type="button" data-reset>重新拉</button><p data-save-note aria-live="polite"></p></div>`);
    addRoom('archive', '<div class="space-archive-empty"><p>还没有留下的形状。</p><a data-go="lab" href="' + roomHref('lab') + '">去拉一条光</a></div><ol class="space-history" aria-label="你留下的形状"></ol><div class="space-compare" hidden><button type="button" data-previous>前一条</button><time data-revision-time></time><button type="button" data-next>后一条</button></div>');
    addRoom('guestbook', `<form class="space-guest-form" aria-describedby="space-letter-privacy">
      <div class="space-guest-meta"><label for="space-name">怎么称呼你<input id="space-name" name="name" autocomplete="nickname" maxlength="40" required></label><label for="space-mail">邮箱（不公开）<input id="space-mail" name="mail" type="email" autocomplete="email" maxlength="254" required></label></div>
      <label for="space-message">想留下的话<textarea id="space-message" name="message" maxlength="1000" rows="4" required></textarea></label>
      <p id="space-letter-privacy">留言公开显示，所有访客都能看到</p><div data-letter-captcha></div>
      <div class="space-form-end"><span data-count>0 / 1000</span><button type="submit" disabled>公开留言</button></div><p class="journey-letter-status" data-letter-status role="status"></p>
      </form><section class="space-letter-board" aria-label="大家留下的话"><div class="space-letter-heading"><h2>留下的话</h2><button type="button" data-letter-refresh>刷新留言</button></div><p data-letter-list-status role="status"></p><ol data-letters></ol><button type="button" data-letter-more hidden>更早的留言</button></section>`);
  } else {
    const blog = addRoom('blog', '<div class="space-blog-index"><ol class="space-posts"></ol></div><article class="space-article" hidden><a class="space-back-index" href="/?paper=0617" data-index>所有文章</a><header><h2 tabindex="-1"></h2></header><div class="space-prose"></div><a class="space-article-end" href="/?paper=0617" data-index>回目录</a></article>');
    const list = blog.querySelector('ol');
    for (const post of posts) {
      const li = document.createElement('li'), a = document.createElement('a'), title = document.createElement('span');
      a.href = post.href; a.dataset.post = post.slug; title.textContent = post.title;
      a.append(title); li.append(a); list.append(li);
    }
    shell.querySelector('[data-map]').hidden = true;
  }

  const nodeElements = [...shell.querySelectorAll('[data-node]')];
  let labRect = null;
  function placeNode(index, rect) {
    nodeElements[index].style.transform = `translate3d(${nodes[index][0] * rect.width}px, ${nodes[index][1] * rect.height}px, 0)`;
  }
  function updateNodes() {
    if (room !== 'lab') return;
    nodeElements.forEach((_, i) => placeNode(i, labRect));
    light.shape(nodes, labRect);
  }
  function updateRig() {
    if (disposed) return;
    const element = room === 'lab' ? shell.querySelector('.space-rig') : room === 'works' ? shell.querySelector('.space-work-light') : room === 'archive' ? shell.querySelector('.space-history') : null;
    if (element) {
      const r = element.getBoundingClientRect();
      const rect = { x: r.x, y: r.y, width: r.width, height: r.height };
      if (room === 'lab') {
        labRect = rect;
        nodeElements.forEach((_, i) => placeNode(i, rect));
      }
      if (room === 'archive' && sketches[revisionIndex]) light.preview(sketches[revisionIndex].nodes, rect);
      else light.shape(nodes, rect);
    }
  }
  function updateNav() {
    shell.querySelector('[data-return]').hidden = site !== 'blog' && !menu && shell.dataset.silence !== 'true';
    nav.querySelectorAll('a').forEach(link => {
      const dest = link.dataset.roomLink;
      const homeLinks = shell.dataset.silence === 'true' ? ['archive', 'blog'] : ['works', 'lab', 'blog'];
      const visible = site === 'blog' ? dest === 'home' : menu || (room === 'home' && homeLinks.includes(dest));
      link.dataset.visible = String(visible); link.inert = !visible;
      if (dest === room) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  }

  function closeConversation() {
    const restoreFocus = replies.contains(document.activeElement);
    talking = false; replies.hidden = true; replies.replaceChildren();
    shell.querySelector('[data-talk]').setAttribute('aria-expanded', 'false');
    delete shell.dataset.talking;
    if (restoreFocus) shell.querySelector('[data-talk]').focus({ preventScroll: true });
  }
  function showReplies(items) {
    const restoreFocus = replies.contains(document.activeElement);
    replies.replaceChildren(); replies.hidden = false;
    for (const [label, fn] of items) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', fn, { signal }); replies.append(b);
    }
    if (restoreFocus) replies.firstElementChild.focus({ preventScroll: true });
  }
  function dialogue(text, items) {
    if (menu) toggleMap(false);
    talking = true; shell.dataset.talking = 'true';
    shell.querySelector('[data-talk]').setAttribute('aria-expanded', 'true');
    speak(text, { note: '' }); showReplies(items);
    replies.firstElementChild.focus({ preventScroll: true });
  }
  function converse() {
    if (talking) { closeConversation(); return; }
    adventure.talk();
  }
  function toggleMap(value = !menu) {
    closeConversation(); menu = value;
    motion.layout([voicePlace, ...nav.children], () => {
      shell.dataset.map = String(menu); content.inert = menu; updateNav();
    }, 12);
    shell.querySelector('[data-map]').setAttribute('aria-expanded', String(menu));
    speak(menu ? LINES.map : headingForRoom(), { note: '' });
  }
  function headingForRoom() {
    return adventure.heading(room);
  }
  function selectRoom(next, { push = false, announce = true } = {}) {
    if (!panels.has(next)) throw new Error(`No ${site} panel: ${next}`);
    adventure.closeScene(); closeConversation(); menu = false; drag = null;
    shell.querySelector('[data-map]').setAttribute('aria-expanded', 'false');
    if (push) history.pushState({ ...history.state, p34Room: next }, '', roomHref(next));
    room = next;
    content.inert = false;
    motion.layout([voicePlace, ...nav.children], () => {
      shell.dataset.room = room; shell.dataset.map = 'false';
      for (const [key, panel] of panels) {
        const selected = key === room;
        panel.dataset.active = String(selected); panel.inert = !selected;
        panel.setAttribute('aria-hidden', String(!selected));
      }
      updateNav();
    }, 10);
    light.scene(room); updateRig();
    if (room === 'archive') renderHistory();
    adventure.room(room, announce);
    document.title = `${LABELS[room]} · 她的空间`;
    if (push) { window.scrollTo({ top: 0, behavior: 'instant' }); voice.tabIndex = -1; (shell.dataset.silence==='true'?shell.querySelector('.residue-back:not([hidden]),.residue-remnants:not([hidden]) a'):voice).focus({ preventScroll: true }); }
    later(updateRig, 650);
  }

  async function openPost(post, push) {
    if (post && !adventure.canRead(post.slug)) { setStatus('这篇还没有写下。'); post = null; }
    const request = ++articleRequest;
    if (post && !articleCache.has(post.slug)) {
      if (push) setStatus('正在载入文章');
      try {
        const response = await fetch(post.href, { signal });
        if (!response.ok) throw new Error(`Article: HTTP ${response.status}`);
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const body = doc.querySelector(`[data-p34-native-post="${post.slug}"] .space-native-prose`);
        if (!body) throw new Error('Article body missing');
        articleCache.set(post.slug, document.importNode(body, true));
      } catch (error) {
        if (signal.aborted || request !== articleRequest) return;
        setStatus('文章加载失败，可再次点标题重试。');
        under.textContent = '文章加载失败，可再次点标题重试。';
        console.error(error); return;
      }
    }
    if (disposed || leaving || request !== articleRequest) return;
    const update = () => {
    if (disposed || leaving || request !== articleRequest) return;
    closeConversation(); articleOpen = Boolean(post);
    shell.dataset.article = String(articleOpen);
    const panel = panels.get('blog'), article = panel.querySelector('article'), index = panel.querySelector('.space-blog-index');
    index.hidden = articleOpen; article.hidden = !articleOpen;
    if (post) {
      article.querySelector('h2').textContent = post.title;
      const prose = article.querySelector('.space-prose');
      if (prose.dataset.slug !== post.slug) {
        prose.replaceChildren(); prose.dataset.slug = post.slug;
        prose.append(articleCache.get(post.slug));
      }
      document.title = `${post.title} · 她写的`;
      speak(shell.dataset.silence === 'true' ? LINES.closedReading : LINES.reading, { note: '', animate: push });
      adventure.opened(post.slug);
    } else {
      document.title = LINES.closedReading; speak(headingForRoom(), { note: '', animate: push });
    }
    if (push) {
      history.pushState({ ...history.state, p34Post: post?.slug || null }, '', post ? post.href : '/?paper=0617');
      window.scrollTo({ top: 0, behavior: 'instant' });
      (post ? article.querySelector('h2') : voice).focus({ preventScroll: true });
    }
    };
    if (push && document.startViewTransition && !motion.reduced()) {
      articleTransition?.skipTransition();
      articleTransition = document.startViewTransition(update);
    } else update();
  }

  function renderHistory() {
    const panel = panels.get('archive'); if (!panel) return;
    panel.querySelector('.space-archive-empty').hidden = sketches.length > 0;
    panel.querySelector('.space-compare').hidden = sketches.length === 0;
    const list = panel.querySelector('ol'); list.replaceChildren();
    sketches.forEach((entry, i) => {
      const li = document.createElement('li'), button = document.createElement('button'), time = document.createElement('time');
      button.type = 'button'; button.dataset.revision = String(i);
      time.dateTime = new Date(entry.at).toISOString(); time.textContent = new Date(entry.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const label = document.createElement('span'); label.textContent = `留下的第 ${i + 1} 条`;
      button.append(time, label); li.append(button); list.append(li);
    });
    if (sketches.length) showRevision(revisionIndex < 0 ? sketches.length - 1 : Math.min(revisionIndex, sketches.length - 1));
  }
  function showRevision(index) {
    revisionIndex = Math.max(0, Math.min(sketches.length - 1, index));
    const panel = panels.get('archive'), entry = sketches[revisionIndex];
    panel.querySelectorAll('[data-revision]').forEach((el, i) => el.setAttribute('aria-pressed', String(i === revisionIndex)));
    panel.querySelector('[data-previous]').disabled = revisionIndex === 0;
    panel.querySelector('[data-next]').disabled = revisionIndex === sketches.length - 1;
    const time = panel.querySelector('[data-revision-time]');
    time.dateTime = new Date(entry.at).toISOString(); time.textContent = `${revisionIndex + 1} / ${sketches.length}`;
    updateRig();
  }
  function saveLight() {
    const entry = { version: 1, at: Date.now(), nodes: cloneNodes(nodes) };
    const next = [...sketches, entry].slice(-8);
    const note = shell.querySelector('[data-save-note]');
    try { localStorage.setItem(SKETCH_KEY, JSON.stringify(next)); }
    catch { note.textContent = '浏览器没有允许保存，这次先留在当前页。'; return; }
    sketches = next; revisionIndex = sketches.length - 1;
    adventure.record('light-saved', nodes);
    note.textContent = '存好了，只留在这台设备。';
    if (shell.dataset.silence !== 'true') speak(LINES.lightSaved, { note: '', mood: 'bright' });
    const r = shell.querySelector('.space-node').getBoundingClientRect(); light.burst(r.x, r.y, 36);
    motion.tone(4, true);
  }
  function noteDrag() {
    adventure.record('light-moved');
    if (shell.dataset.silence === 'true') return;
    if (talking || performance.now() - lastRemark < 4200) return;
    lastRemark = performance.now(); dragCount++;
    const lines = LINES.lightDrag;
    speak(lines[(dragCount - 1) % lines.length], { mood: dragCount % 2 ? 'bright' : 'thought', note: '' });
    motion.tone(dragCount, true);
  }

  listen(shell, 'click', event => {
    const el = event.target.closest('button, a'); if (!el || !shell.contains(el) || leaving) return;
    cancelPassage(shell);
    if (el.matches('[data-talk]')) converse();
    else if (el.matches('[data-return]')) void sendBack();
    else if (el.matches('[data-map]')) toggleMap();
    else if (el.matches('[data-sound]')) {
      motion.setSound(!motion.sound); el.setAttribute('aria-pressed', String(motion.sound)); el.setAttribute('aria-label', motion.sound ? '关闭声音' : '开启声音');
    } else if (el.matches('[data-go], [data-room-link]')) {
      const next = el.dataset.go || el.dataset.roomLink;
      const external = site === 'blog' && next === 'home' || site === 'home' && next === 'blog';
      if (!external && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); selectRoom(next, { push: true }); }
    } else if (el.matches('[data-touch-light]')) {
      adventure.record('touch');
      light.turn();
      void motion.layout([voicePlace, ...nav.children], () => { shell.dataset.shift = shell.dataset.shift === 'true' ? 'false' : 'true'; }, 16);
      const r = el.getBoundingClientRect(); light.burst(r.x + r.width / 2, r.y + r.height / 2, 42);
      motion.tone(3, true);
      void motion.animate(el, [{ scale: '1' }, { scale: '1.8', offset: .25 }, { scale: '.8', offset: .6 }, { scale: '1' }], { duration: 850 });
      speak(LINES.touch, { mood: 'bright', note: '' });
    } else if (el.matches('[data-save]')) saveLight();
    else if (el.matches('[data-reset]')) {
      nodes = cloneNodes(INITIAL_LIGHT); updateNodes(); if (shell.dataset.silence !== 'true') speak(LINES.lightReset, { note: '' });
    } else if (el.matches('[data-revision]')) showRevision(Number(el.dataset.revision));
    else if (el.matches('.space-compare [data-previous]')) showRevision(revisionIndex - 1);
    else if (el.matches('.space-compare [data-next]')) showRevision(revisionIndex + 1);
    else if (el.matches('[data-post]')) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); openPost(posts.find(post => post.slug === el.dataset.post), true);
    } else if (el.matches('[data-index]')) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); openPost(null, true);
    }
  });
  listen(shell, 'pointerdown', event => {
    const el = event.target.closest('.space-node'); if (drag || !el || room !== 'lab' || event.button !== 0) return;
    const rect = shell.querySelector('.space-rig').getBoundingClientRect();
    drag = { index: Number(el.dataset.node), id: event.pointerId, el, rect, moved: false };
    el.setPointerCapture(event.pointerId); el.dataset.dragging = 'true';
    event.preventDefault();
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const { el, moved, index } = drag; drag = null; delete el.dataset.dragging;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    if (moved) { const r = el.getBoundingClientRect(); light.burst(r.x + r.width / 2, r.y + r.height / 2, 18); noteDrag(); setStatus(`光点 ${index + 1} 已移动`); }
  }
  listen(shell, 'pointerup', endDrag); listen(shell, 'pointercancel', endDrag); listen(shell, 'lostpointercapture', endDrag);
  listen(window, 'pointermove', event => {
    if (drag) {
      if (event.pointerId !== drag.id) return;
      nodes[drag.index] = [Math.max(.04, Math.min(.96, (event.clientX - drag.rect.x) / drag.rect.width)), Math.max(.04, Math.min(.96, (event.clientY - drag.rect.y) / drag.rect.height))];
      drag.moved = true;
      placeNode(drag.index, drag.rect); light.shape(nodes, drag.rect);
    } else if (!articleOpen && room !== 'blog' && shell.dataset.silence!=='true' && !shell.dataset.experience) light.pointer(event.clientX, event.clientY);
  }, { passive: true });
  listen(shell, 'keydown', event => {
    const el = event.target.closest('.space-node');
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!el || !direction) return;
    event.preventDefault(); const i = Number(el.dataset.node), step = event.shiftKey ? .05 : .012;
    nodes[i] = nodes[i].map((n, axis) => Math.max(.04, Math.min(.96, n + direction[axis] * step)));
    updateNodes(); noteDrag();
  });
  const message = shell.querySelector('textarea');
  if (message) {
    listen(message, 'input', () => { shell.querySelector('[data-count]').textContent = `${message.value.length} / 1000`; });
    listen(shell.querySelector('form'), 'submit', event => event.preventDefault());
  }
  listen(window, 'keydown', event => {
    if (event.key !== 'Escape') return;
    if (talking) { closeConversation(); shell.querySelector('[data-talk]').focus(); }
    else if (menu) { toggleMap(false); shell.querySelector('[data-map]').focus(); }
  });
  function fromLocation() {
    if (new URLSearchParams(location.search).get('paper') !== '0617') { cleanup(); return; }
    if (site === 'blog') openPost(posts.find(post => location.pathname.replace(/\/$/, '') === post.path) || null, false);
    else selectRoom(roomFromURL(location.href), { announce: true });
  }
  listen(window, 'popstate', fromLocation); listen(window, 'p34:navigate', fromLocation);
  listen(window, 'resize', updateRig); listen(window, 'scroll', updateRig, { passive: true });
  listen(window, 'p34:send-back', sendBack); listen(window, 'paper:return', sendBack);

  async function sendBack() {
    if (leaving) return; leaving = true; adventure.closeScene(); closeConversation();
    if (shell.dataset.silence !== 'true') speak(LINES.leave, { note: '' });
    await playPassage(shell, normalPage, motion, false);
    if (disposed) return;
    const url = new URL(originalURL); url.searchParams.delete('paper'); url.searchParams.delete('room');
    const ownNote = site === 'blog' && url.pathname.startsWith('/notes/');
    if (ownNote) { cleanup(); location.assign('/'); return; }
    history.replaceState(normalState, '', url.pathname + url.search + url.hash);
    cleanup();
    if (!motion.reduced()) normalPage.words.forEach(({ el }, i) => {
      el.animate([{ opacity: .45, translate: '0px 10px' }, { opacity: 1, translate: '0px 0px' }], { duration: 500, delay: i * 22, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
  }
  function cleanup() {
    if (disposed) return; disposed = true; articleRequest++; articleTransition?.skipTransition(); controller.abort(); timers.forEach(clearTimeout); timers.clear();
    shell.remove(); for (const [el, mark] of parked) mark.replaceWith(el);
    html.classList.remove('p34-spatial', 'p34-luminous', 'p34-world', 'p34-ready');
    delete html.dataset.p34Active; delete html.dataset.p34Site;
    if (ownedStyle) style.remove(); document.title = originalTitle;
    window.scrollTo(0, originalScroll); active.delete(html);
  }
  active.set(html, cleanup);
  const adventure = mountAdventure({ shell, site, motion, speak, dialogue, quiet: closeConversation,
    go: next => selectRoom(next, { push: true }), getRoom: () => room, getSketches: () => sketches,
    leave: sendBack, cookie, signal });
  selectRoom(room, { announce: false }); updateNodes();
  if (site === 'blog') fromLocation();
  else speak(headingForRoom(), { note: '', animate: true, origins: sources });
  if (storageError && room === 'archive') speak(LINES.cannotSave, { note: '浏览器限制了本地存储，实验仍然可以玩' });
  if(html.dataset.p34FromDesk==='true'&&shell.dataset.silence!=='true'&&shell.dataset.reunion!=='true')void playPassage(shell, normalPage, motion, true);
  history.replaceState({ ...history.state, p34Space: true }, '', location.href);
  delete html.dataset.p34FromDesk;
  return cleanup;
}
