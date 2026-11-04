// Fullscreen girl-owned blog world for Project 34 (?paper=0617).
// Shared world/motion modules retain the cross-site state contract.
import {
  WORLD_COOKIE_KEY,
  readWorldCookie,
  advanceEncounterState,
  serializeWorldState,
  createWorldSession,
} from './p34-living.js?v=20261102-r12';
import { readBreakoutCookie } from './p34-breakout-state.js?v=20261104-fold';
import { createMotion } from './p34-motion.js?v=20261102-r12';
import { createParticleStage } from './p34-fx.js?v=20261104-fold';
import { timeOfVisit, mountVisitEvents } from './p34-dialogue.js?v=20261102-r12';
import {
  HER_OWN_POSTS,
  normalizeBlogPath,
  getOwnPostBySlug,
  getOwnPostByPath,
  isOwnNotePath,
} from './p34-own-posts.js?v=20261104-fold';

export {
  HER_OWN_POSTS,
  normalizeBlogPath,
  getOwnPostBySlug,
  getOwnPostByPath,
  isOwnNotePath,
};

export function formatBreakoutNote(breakout, homeUrl = 'https://sayori.org/?paper=0617') {
  if (!breakout || !Number.isFinite(Number(breakout.runs)) || Number(breakout.runs) <= 0) {
    return null;
  }
  const runs = Math.max(0, Math.trunc(Number(breakout.runs)));
  const bestScore = Math.max(0, Math.trunc(Number(breakout.bestScore) || 0));
  const maxCombo = Math.max(0, Math.trunc(Number(breakout.maxCombo) || 0));
  return {
    runs,
    bestScore,
    maxCombo,
    text: `你在主页留下的弹球最高纪录：${bestScore} 分 · 最高 ${maxCombo} 连击。`,
    linkHref: homeUrl,
    linkText: '回主页再打一局 ↗',
  };
}

export function resolveLegacyBlogHash(hash = '', pathname = '/') {
  const key = String(hash || '').trim().replace(/^#/, '');
  const cleanPath = normalizeBlogPath(pathname);
  if (!key) return null;
  if (key === 'blog') {
    return {
      type: 'index',
      key,
      slug: null,
      openChatNode: null,
      targetPath: '/',
      targetHref: '/?paper=0617',
      message: '这几页都是我自己写的手记，挑一篇顺眼的慢慢读就好。',
    };
  }
  if (key === 'space' || key === 'play' || key === 'note-light-folds' || key === 'note-moving-words') {
    const post = getOwnPostBySlug('prism-and-paddle');
    return {
      type: 'article',
      key,
      slug: post.slug,
      openChatNode: 'talk-prism',
      targetPath: post.path,
      targetHref: post.href,
      message: post.voiceRemark,
    };
  }
  if (key === 'log' || key === 'note-half-torn' || key === 'note-borrowed-margin') {
    const post = getOwnPostBySlug('empty-corners');
    return {
      type: 'article',
      key,
      slug: post.slug,
      openChatNode: 'talk-corners',
      targetPath: post.path,
      targetHref: post.href,
      message: post.voiceRemark,
    };
  }
  if (key === 'note-afternoon' || key === 'afternoon-rankings') {
    const post = getOwnPostBySlug('afternoon-rankings');
    return {
      type: 'article',
      key,
      slug: post.slug,
      openChatNode: 'talk-afternoon',
      targetPath: post.path,
      targetHref: post.href,
      message: post.voiceRemark,
    };
  }
  const bySlug = getOwnPostBySlug(key.replace(/^note-/, ''));
  if (bySlug) {
    return {
      type: 'article',
      key,
      slug: bySlug.slug,
      openChatNode: null,
      targetPath: cleanPath === bySlug.path ? cleanPath : bySlug.path,
      targetHref: bySlug.href,
      message: bySlug.voiceRemark,
    };
  }
  return null;
}

export function shouldCarryPaperQuery(rawHref, currentOrigin = 'https://blog.sayori.org') {
  if (!rawHref || typeof rawHref !== 'string') return null;
  if (rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('javascript:')) return null;
  try {
    const url = new URL(rawHref, currentOrigin);
    const isSameOrigin = url.origin === currentOrigin;
    const isMainHome = url.hostname === 'sayori.org' || url.hostname === 'www.sayori.org';
    if (!isSameOrigin && !isMainHome) return null;
    if (isSameOrigin && (/^\/(?:api|admin|rss|atom|og)\b/.test(url.pathname) || /\.(?:xml|json|txt|png)$/i.test(url.pathname))) {
      return null;
    }
    if (url.searchParams.get('paper') === '0617') return null;
    url.searchParams.set('paper', '0617');
    return rawHref.startsWith('http') ? url.toString() : url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function initialVoiceCopy(pathname = '/', encounterType = 'blog-first') {
  const post = getOwnPostByPath(pathname);
  if (post) return post.voiceRemark;
  if (encounterType === 'blog-first') return '哎，先别翻！……算了，给你看。';
  if (encounterType === 'blog-from-home') return '主页那边玩够了？来挑一篇。';
  return '又翻回来了？我还没加新的。';
}

export const initialMarkerCopy = initialVoiceCopy;

export function applyReadingEncounterStory(currentStory) {
  if (!currentStory || typeof currentStory !== 'object') return currentStory;
  if (currentStory.met && currentStory.chapter !== 'arrive') {
    return { ...currentStory };
  }
  return {
    ...currentStory,
    met: 1,
    chapter: currentStory.chapter === 'arrive' ? 'explore' : currentStory.chapter,
  };
}

const choice = (id, label) => ({ id, label });

function blogRootNode(_story, c) {
  const post = getOwnPostByPath(c.pathname || '/') || getOwnPostBySlug(c.activeSlug || '');
  const choices = post
    ? [choice(post.slug === 'prism-and-paddle' ? 'talk-prism' : post.slug === 'empty-corners' ? 'talk-corners' : 'talk-afternoon', '这篇我想问问你。'), choice('open-index','看看其他的。')]
    : [choice('talk-prism','你在折腾什么？'),choice('talk-corners','你放的那些东西，都能碰？')];
  choices.push(choice('return','送我去普通博客。'));
  if(c.lingered) choices.unshift(choice('linger','你刚才是不是在偷看？'));
  return {text: post ? post.voiceRemark : '看完可以告诉我你怎么想。不同意也可以。', pose:'rest', choices};
}
const READING_NODES = {
  root: blogRootNode, 'blog-root': blogRootNode,
  'talk-prism': (_s,c) => {
    const note = formatBreakoutNote(c.breakout);
    return {text:'球会把字撞歪。我最喜欢的是打完以后，假装什么都没发生，全部摆回去。' + (note ? '\n'+note.text : ''),pose:'unfold',choices:[choice('open-prism','读读你写的。'),choice('stay','行，我接着看。')]};
  },
  'talk-corners': {text:'能碰。边上那个还可以拉。\n不过拉完要松手，我得把整页拽回来。',pose:'align',choices:[choice('open-corners','那我看看这篇。'),choice('stay','知道了。')]},
  'talk-afternoon': {text:'我坚持汽水第一。不接受闹钟。\n你要提名的话，先让我听听。',pose:'gather',choices:[choice('open-afternoon','再看一遍你的榜单。'),choice('stay','那你先排着。')]},
  'talk-amiya': {text:'他的在另一面。这边都是我写的。',pose:'rest',choices:[choice('return','送我过去。'),choice('stay','我先看你的。')]},
  linger: {text:'我想知道你读到哪儿了。\n……不催，你慢慢看。',pose:'gather',choices:[choice('stay','那别偷改我正在看的字。'),choice('talk-afternoon','汽水凭什么第一？')]},
  'open-prism': {action:'open-post',slug:'prism-and-paddle',href:'/notes/prism-and-paddle/?paper=0617'},
  'open-corners': {action:'open-post',slug:'empty-corners',href:'/notes/empty-corners/?paper=0617'},
  'open-afternoon': {action:'open-post',slug:'afternoon-rankings',href:'/notes/afternoon-rankings/?paper=0617'},
  'open-index': {action:'open-index',href:'/?paper=0617'},
  return: {action:'return'}, stay: {action:'close'},
};

export function readingDialogueNode(id, story, context = {}) {
  const c = { period: 'afternoon', lingered: false, pathname: '/', activeSlug: null, ...context };
  const node = READING_NODES[id];
  if (!node) throw new Error('Unknown Project 34 reading dialogue node: ' + id);
  return typeof node === 'function' ? node(story, c) : node;
}

function mountInlineConversation({
  root,
  host,
  call,
  motion,
  signal,
  getStory,
  sendBack,
  onNode = () => {},
  onAction = () => {},
  onOpen = () => {},
  onClose = () => {},
  getContext = () => ({}),
}) {
  const panel = document.createElement('section');
  panel.id = 'p34-conversation';
  panel.className = 'p34-conversation p34-inline-chat';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'p34-her-line');
  panel.hidden = true;
  panel.innerHTML = `<div class="p34-dialogue-tools"><button type="button" class="p34-sound-toggle" data-p34-sound aria-pressed="false" aria-label="开启声效">♪</button><button type="button" data-dialogue="root" class="p34-change-topic" hidden>换个话题</button><button type="button" class="p34-goodbye">收起</button></div><div class="p34-her"><p id="p34-her-line" class="p34-her-line" aria-live="polite"></p></div><div class="p34-response"><div class="p34-answers" aria-label="你的回应"></div><nav class="p34-more" aria-label="其他话题" hidden><button type="button" data-turn="-1">上一页</button><button type="button" data-turn="1">更多话题</button></nav></div>`;
  host.append(panel);
  call.setAttribute('aria-controls', panel.id);
  call.setAttribute('aria-expanded', 'false');

  const line = panel.querySelector('.p34-her-line');
  const answers = panel.querySelector('.p34-answers');
  const more = panel.querySelector('.p34-more');
  const soundBtn = panel.querySelector('[data-p34-sound]');
  const changeTopicBtn = panel.querySelector('.p34-change-topic');
  const listen = (el, event, fn) => el.addEventListener(event, fn, { signal });
  let talking = false;
  let returnFocus = null;
  let current = null;
  let offset = 0;

  function syncSoundButton() {
    const active = Boolean(motion.sound);
    soundBtn.setAttribute('aria-pressed', String(active));
    soundBtn.setAttribute('aria-label', active ? '关闭声效' : '开启声效');
  }
  syncSoundButton();

  function renderAnswers() {
    answers.replaceChildren(...current.choices.slice(offset, offset + 3).map(c => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.dialogue = c.id;
      button.textContent = c.label;
      return button;
    }));
    more.hidden = current.choices.length <= 3;
    more.firstElementChild.disabled = offset === 0;
    more.lastElementChild.disabled = offset + 3 >= current.choices.length;
    answers.firstElementChild?.focus({ preventScroll: true });
  }

  async function showNode(id) {
    const ctx = {
      period: timeOfVisit(new Date().getHours()),
      ...getContext(),
    };
    const node = readingDialogueNode(id, getStory(), ctx);
    if (node.action) {
      if (node.action === 'return') {
        close();
        await sendBack();
      } else if (node.action === 'navigate') {
        close();
        location.assign(node.href || 'https://sayori.org/?paper=0617');
      } else if (node.action === 'close') {
        close();
      } else {
        close();
        await onAction(node, id);
      }
      return;
    }
    current = node;
    offset = 0;
    motion.cancelText(line);
    line.getAnimations().forEach(a => a.cancel());
    line.textContent = node.text;
    changeTopicBtn.hidden = id === 'root' || id === 'blog-root';
    renderAnswers();
    await onNode(node, id);
  }

  function open(initialNode = 'root') {
    if (talking) {
      if (typeof initialNode === 'string') void showNode(initialNode);
      return;
    }
    returnFocus = document.activeElement;
    talking = true;
    panel.hidden = false;
    root.classList.add('p34-chat-open');
    call.setAttribute('aria-expanded', 'true');
    onOpen();
    void showNode(typeof initialNode === 'string' ? initialNode : 'root');
    void motion.animate(panel, [{ opacity: 0, translate: '0 -4px' }, { opacity: 1, translate: '0 0' }], { duration: 200 });
    motion.tone(0, true);
  }

  function close() {
    if (!talking) return;
    talking = false;
    panel.hidden = true;
    onClose();
    root.classList.remove('p34-chat-open');
    call.setAttribute('aria-expanded', 'false');
    (returnFocus?.isConnected ? returnFocus : call)?.focus({ preventScroll: true });
  }

  function toggle() {
    if (talking) close();
    else open('root');
  }

  listen(call, 'click', toggle);
  listen(panel.querySelector('.p34-goodbye'), 'click', close);
  listen(soundBtn, 'click', () => {
    motion.setSound(!motion.sound);
    syncSoundButton();
  });
  listen(panel, 'click', e => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const turn = target.closest('[data-turn]');
    if (turn) {
      offset += Number(turn.dataset.turn) * 3;
      renderAnswers();
      return;
    }
    const button = target.closest('[data-dialogue]');
    if (!button) return;
    motion.tone(2, true);
    void showNode(button.dataset.dialogue);
  });
  listen(panel, 'keydown', e => {
    if (e.key === 'Escape' && talking) {
      e.preventDefault();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const buttons = [...answers.children];
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    ].focus();
  });
  signal.addEventListener('abort', () => { close(); panel.remove(); }, { once: true });

  return {
    open,
    close,
    toggle,
    showNode,
    panel,
    get talking() { return talking; },
    destroy() { close(); panel.remove(); },
  };
}

function buildIndexEntryHtml(post) {
  return `<li class="p34-index-item" data-p34-index-slug="${post.slug}">
    <article class="p34-index-article" data-p34-article-slug="${post.slug}">
      <time class="p34-entry-date">${post.date}</time>
      <h2 class="p34-entry-title" tabindex="-1"><a href="${post.href}" data-p34-post-link="${post.slug}">${post.title}</a></h2>
      <div class="p34-entry-body" inert><div class="p34-body-inner">
        <p class="p34-article-lead">${post.lead}</p>
        <div class="p34-article-prose">${post.sections.map(section=>`<section class="p34-prose-section">${section.heading?`<h3>${section.heading}</h3>`:''}${section.paragraphs.map(p=>`<p>${p}</p>`).join('')}</section>`).join('')}</div>
        <button type="button" class="p34-margin-secret" data-p34-doodle aria-label="碰一下这个句号"><svg viewBox="0 0 180 60" aria-hidden="true"><path d="M12 28 C50 5 75 49 105 25 S145 16 158 28"/><circle cx="168" cy="28" r="4"/></svg></button>
        <p class="p34-doodle-reply" hidden>别戳了。句号都要掉下去了。</p>
        <a class="p34-back-index" href="/?paper=0617" data-p34-nav="index">← 看别的</a>
      </div></div>
    </article>
  </li>`;
}

const activeMounts = new WeakMap();

export function mountReadingWorld() {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  const root = document.documentElement;
  if (activeMounts.has(root)) return activeMounts.get(root);
  const main = document.querySelector('#swup-container, #main-content, main');
  if (!main) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const motion = createMotion(signal);
  const fx = createParticleStage({ signal, motion });
  const shell = main.closest('.desk-shell');
  const originalTitle = document.title;
  const originalURL = location.href;
  const originalState = history.state;
  const initialPathname = normalizeBlogPath(location.pathname);
  const startedOnOwnNoteRoute = isOwnNotePath(initialPathname);

  const originalMainFragment = document.createDocumentFragment();
  const parked = [];
  let conversation = null;
  let lingered = false;
  let leaving = false;
  let destroyed = false;
  let activeSlug = getOwnPostByPath(initialPathname)?.slug || null;

  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });

  const { cookie, getStory, setStory } = createWorldSession();
  const encounter = advanceEncounterState(readWorldCookie(document.cookie), 'blog');
  cookie(WORLD_COOKIE_KEY, serializeWorldState(encounter.state));
  const currentStory = getStory();
  if (!currentStory.met || currentStory.chapter === 'arrive') {
    setStory(applyReadingEncounterStory(currentStory));
  }

  let style = document.querySelector('link[data-p34-reading-style]');
  if (!style) {
    style = document.createElement('link');
    style.rel = 'stylesheet';
    style.dataset.p34ReadingStyle = '';
    document.head.append(style);
  }
  if (!style.href.includes('20261104-fold')) {
    style.href = '/p34-reading.css?v=20261104-fold';
  }

  function parkElement(el) {
    if (!el || !el.isConnected || main.contains(el) || el.contains(main)) return;
    const mark = document.createComment('p34-parked-node');
    el.before(mark);
    el.remove();
    parked.push([el, mark]);
  }

  // Safely park all normal Amiya blog chrome and retain original main children in a fragment.
  document.querySelectorAll('.desk-header, #navbar-wrapper, .desk-footer, .reading-toc, .reading-related, .desk-music-entry, #pio-container, .skip-link').forEach(parkElement);
  originalMainFragment.append(...main.childNodes);

  root.classList.remove('p34-world');
  root.classList.add('p34-luminous', 'p34-ready');
  root.dataset.p34Site = 'blog';
  root.dataset.p34Active = 'true';
  main.classList.add('p34-reading-active');
  shell?.classList.add('p34-shell-active');

  // Construct her single coherent open spatial blog root.
  const worldRoot = document.createElement('div');
  worldRoot.className = 'p34-own-blog';
  worldRoot.dataset.p34OwnRoot = 'true';
  worldRoot.dataset.p34View = activeSlug ? 'article' : 'index';
  worldRoot.setAttribute('data-pagefind-ignore', 'all');

  worldRoot.innerHTML = `
    <div class="p34-reading-architecture" aria-hidden="true"><div class="p34-reading-fold p34-reading-mist"></div><div class="p34-reading-fold p34-reading-paper"></div><div class="p34-reading-fold p34-reading-ink"></div><svg class="p34-writing-trail" viewBox="0 0 1400 1000" preserveAspectRatio="none"><path d="M-40 890 C310 990 270 210 650 330 S1070 600 1440 80"/></svg></div>
    <header class="p34-own-masthead">
      <a href="/?paper=0617" class="p34-wordmark" data-p34-nav="index" aria-label="她写的东西"><svg viewBox="0 0 52 32" aria-hidden="true"><path d="M2 25 19 5 31 25 49 5"/><path d="M30 5h19v19"/></svg></a>
      <a href="https://sayori.org/?paper=0617" class="p34-own-nav-home" data-p34-home-link>回去玩 ↗</a>
    </header>
    <div class="p34-own-layout">
      <aside class="p34-own-margin" aria-label="她说">
        <p class="p34-voice-line" data-p34-voice-line data-p34-marker-line aria-live="polite"></p>
        <div class="p34-inline-presence" data-p34-presence="true"><button type="button" class="p34-call" data-p34-call aria-controls="p34-conversation" aria-expanded="false"><span class="p34-call-label">说句话 ···</span></button></div>
      </aside>
      <div class="p34-own-stage" data-p34-stage>
        <header class="p34-index-heading"><h1>写了这些<button type="button" class="p34-ink-dot" data-p34-ink aria-label="点这个句号">。</button></h1></header>
        <ol class="p34-editorial-list">${HER_OWN_POSTS.map(buildIndexEntryHtml).join('')}</ol>
      </div>
    </div>`;

  main.append(worldRoot);

  const voiceLineEl = worldRoot.querySelector('[data-p34-voice-line]');
  const callBtn = worldRoot.querySelector('[data-p34-call]');
  const callLabel = worldRoot.querySelector('.p34-call-label');
  const wordmarkLink = worldRoot.querySelector('.p34-wordmark');
  const entries = [...worldRoot.querySelectorAll('.p34-index-item')];
  const planes = [...worldRoot.querySelectorAll('.p34-reading-fold')];
  const layoutNodes = () => [...planes, ...entries, worldRoot.querySelector('.p34-index-heading'), worldRoot.querySelector('.p34-own-margin')];
  let chatScroll = 0;
  const headings = [...worldRoot.querySelectorAll('.p34-entry-title')];

  function syncTitleAndNav(post) {
    document.title = post ? `${post.title} · 她写的` : '写了这些。';
    if (wordmarkLink) {
      if (!post) wordmarkLink.setAttribute('aria-current', 'page');
      else wordmarkLink.removeAttribute('aria-current');
    }
  }

  function renderActiveView({ slug = null, encounterKind = encounter.encounterType, customVoice = null } = {}) {
    const post = slug ? getOwnPostBySlug(slug) : null;
    activeSlug = post ? post.slug : null;
    worldRoot.dataset.p34View = post ? 'article' : 'index';
    worldRoot.querySelector('.p34-index-heading').inert = Boolean(post);
    for (const entry of entries) {
      const selected = entry.dataset.p34IndexSlug === activeSlug;
      entry.classList.toggle('is-active', selected);
      entry.inert = Boolean(post && !selected);
      entry.querySelector('.p34-entry-body').inert = !selected;
      entry.querySelector('.p34-entry-body').setAttribute('aria-hidden', String(!selected));
      entry.querySelector('.p34-entry-title').setAttribute('aria-level', selected ? '1' : '2');
      entry.querySelector('.p34-entry-title a').tabIndex = selected ? -1 : 0;
    }
    voiceLineEl.textContent = customVoice || initialVoiceCopy(post ? post.path : '/', encounterKind);
    syncTitleAndNav(post);
  }

  renderActiveView({ slug: activeSlug, encounterKind: encounter.encounterType });
  if(root.dataset.p34Entry !== 'quiet') {
    layoutNodes().forEach((el,i)=>void motion.animate(el,[{translate:`${i%2?150:-120}px ${45+i*9}px`,rotate:`${i%2?8:-7}deg`,opacity:0},{translate:'0 0',rotate:getComputedStyle(el).rotate==='none'?'0deg':getComputedStyle(el).rotate,opacity:1}],{duration:1050,delay:i*35}));
  }
  let navSequence = 0;
  async function navigateOwnView(targetSlug = null, { push = true, animate = true, customVoice = null } = {}) {
    const post = targetSlug ? getOwnPostBySlug(targetSlug) : null;
    const nextSlug = post?.slug || null;
    if(nextSlug === activeSlug) return;
    const sequence = ++navSequence;
    const targetHref = post ? post.href : '/?paper=0617';
    const targetPath = post ? post.path : '/';
    if(push && normalizeBlogPath(location.pathname)!==normalizeBlogPath(targetPath)) history.pushState({p34OwnPath:targetPath},'',targetHref);
    const selectedTitle = post ? worldRoot.querySelector(`[data-p34-index-slug="${post.slug}"] .p34-entry-title`) : null;
    const update = ()=>renderActiveView({slug:nextSlug,encounterKind:'blog-return',customVoice});
    const transition = animate ? motion.layout(layoutNodes(),update,18) : Promise.resolve(update());
    if(post && animate) {
      const r=selectedTitle.getBoundingClientRect();
      fx.directionalSpark(r.left+r.width*.6,r.top+r.height*.5,-.45,{palette:'arcane'});
      const paragraphs=[...worldRoot.querySelector('.is-active').querySelectorAll('.p34-prose-section p')];
      paragraphs.forEach((el,i)=>void motion.animate(el,[{opacity:0,translate:`${i%2?24:-24}px 30px`},{opacity:1,translate:'0 0'}],{duration:600,delay:70+i*35}));
    }
    await transition;
    if(sequence!==navSequence||destroyed) return;
    if(post) selectedTitle.focus({preventScroll:true});
    if(conversation?.talking) void conversation.showNode('root');
  }

  conversation = mountInlineConversation({
    root,
    host: worldRoot,
    call: callBtn,
    motion,
    signal,
    getStory,
    sendBack,
    getContext: () => ({
      lingered,
      pathname: activeSlug ? `/notes/${activeSlug}` : '/',
      activeSlug,
      encounterType: encounter.encounterType,
      breakout: readBreakoutCookie(),
    }),
    onOpen() {
      worldRoot.querySelector('.p34-own-stage').inert=true;worldRoot.querySelector('.p34-own-margin').inert=true;wordmarkLink.inert=true;
      chatScroll=window.scrollY;window.scrollTo({top:0,behavior:'instant'});
      void motion.layout(layoutNodes(),()=>{worldRoot.dataset.chat='open';},16);
    },
    onClose() {
      worldRoot.querySelector('.p34-own-stage').inert=false;worldRoot.querySelector('.p34-own-margin').inert=false;wordmarkLink.inert=false;
      void motion.layout(layoutNodes(),()=>{delete worldRoot.dataset.chat;delete worldRoot.dataset.intent;},12);
      window.scrollTo({top:chatScroll,behavior:'instant'});
    },
    onNode(_node, id) {
      void motion.layout(planes,()=>{worldRoot.dataset.intent=id==='talk-corners'?'pull':id==='talk-prism'?'play':'listen';},18);
      if(id==='talk-corners'){ const el=worldRoot.querySelector('.is-active .p34-entry-title')||headings[0];void motion.animate(el,[{rotate:'0deg'},{rotate:'-4deg',offset:.4},{rotate:'0deg'}],{duration:600}); }
      if(id==='talk-prism'){const r=callBtn.getBoundingClientRect();fx.directionalSpark(r.left,r.top,-1,{palette:'blue'});}
      if (id === 'linger') {
        lingered = false;
        callLabel.textContent = '说句话 ···';
      }
    },
    onAction(node) {
      if (node.action === 'open-post' && node.slug) {
        void navigateOwnView(node.slug, { push: true, animate: true });
        return;
      }
      if (node.action === 'open-index') {
        void navigateOwnView(null, { push: true, animate: true });
      }
    },
  });

  mountVisitEvents({
    signal,
    canPlay: () => !conversation.talking,
    onLinger() {
      lingered = true;
      callLabel.textContent = '嗯？';
      voiceLineEl.textContent = '……没走啊。我还以为你看完了。';
      const r=callBtn.getBoundingClientRect();fx.collectBurst(r.left+r.width/2,r.top+r.height/2,{palette:'arcane',scale:.8});
      motion.tone(3, true);
    },
  });

  listen(worldRoot, 'click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const ink=target.closest('[data-p34-ink]');
    if(ink){
      const r=ink.getBoundingClientRect();
      fx.manaNova(r.left+r.width/2,r.top+r.height/2,{palette:'arcane',scale:1.4});
      void motion.layout(layoutNodes(),()=>{worldRoot.dataset.shuffle=worldRoot.dataset.shuffle==='yes'?'no':'yes';},24);
      voiceLineEl.textContent='等下，我把这几篇挪一下。';motion.tone(3,true);return;
    }
    const doodle=target.closest('[data-p34-doodle]');
    if(doodle){
      const line=doodle.nextElementSibling;line.hidden=!line.hidden;
      const r=doodle.getBoundingClientRect();fx.homingVolley(r.right,r.top+r.height/2,[{x:r.left,y:r.top,onHit:()=>{void motion.animate(doodle,[{rotate:'-4deg'},{rotate:'12deg',offset:.4},{rotate:'-4deg'}],{duration:500});}}],{palette:'gold'});
      void motion.animate(doodle,[{scale:'1 1'},{scale:'1.15 .7',offset:.3},{scale:'1'}],{duration:440});return;
    }
    const postLink = target.closest('[data-p34-post-link]');
    if (postLink) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      const slug = postLink.getAttribute('data-p34-post-link');
      if (slug) void navigateOwnView(slug, { push: true, animate: true });
      return;
    }

    const indexLink = target.closest('[data-p34-nav="index"]');
    if (indexLink) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      void navigateOwnView(null, { push: true, animate: true });
    }
  });

  function applyLegacyHash(hash) {
    const resolved = resolveLegacyBlogHash(hash, location.pathname);
    if (!resolved) return;
    if (resolved.slug) {
      void navigateOwnView(resolved.slug, {
        push: false,
        animate: false,
        customVoice: resolved.message,
      });
    } else if (resolved.message) {
      voiceLineEl.textContent = resolved.message;
    }
    if (resolved.openChatNode) {
      conversation.open(resolved.openChatNode);
    }
  }
  if (location.hash) applyLegacyHash(location.hash);
  listen(window, 'hashchange', () => applyLegacyHash(location.hash));

  function syncFromLocation() {
    if (destroyed || leaving) return;
    if (new URLSearchParams(location.search).get('paper') !== '0617') {
      cleanup();
      return;
    }
    const post = getOwnPostByPath(location.pathname);
    const nextSlug = post ? post.slug : null;
    if (nextSlug !== activeSlug) {
      void navigateOwnView(nextSlug, { push: false, animate: true });
    }
  }
  listen(window, 'p34:navigate', syncFromLocation);
  listen(window, 'popstate', syncFromLocation);

  function restore() {
    conversation?.destroy();
    conversation = null;
    worldRoot.remove();
    main.replaceChildren(originalMainFragment);
    for (const [el, mark] of parked) {
      mark.replaceWith(el);
    }
    parked.length = 0;

    main.classList.remove('p34-reading-active', 'p34-host');
    shell?.classList.remove('p34-shell-active');
    root.classList.remove('p34-luminous', 'p34-world', 'p34-ready', 'p34-playing', 'p34-talking', 'p34-chat-open');
    for (const key of ['p34Scene', 'p34Chapter', 'p34Mood', 'p34Site', 'p34Active', 'p34Pose', 'p34Moment', 'p34Entry']) {
      delete root.dataset[key];
    }
    document.querySelectorAll('link[data-p34-reading-style], link[data-p34-living-style]').forEach(el => el.remove());
    document.title = originalTitle;
  }

  async function sendBack() {
    if (leaving) return;
    leaving = true;
    await motion.animate(worldRoot, [{ opacity: 1 }, { opacity: 0, translate: '0px -6px' }], { duration: 220 });
    if (destroyed) return;
    const url = new URL(originalURL);
    url.searchParams.delete('paper');
    url.searchParams.delete('p34s');
    if (/^#(?:space|blog|play|log|note-)/.test(url.hash)) url.hash = '';
    const restorePath = startedOnOwnNoteRoute ? '/' : (url.pathname + url.search + url.hash);
    history.replaceState(originalState, '', restorePath);
    cleanup();
    if (startedOnOwnNoteRoute && typeof location.assign === 'function') {
      location.assign('/');
    }
  }

  listen(window, 'p34:send-back', () => { void sendBack(); });

  function cleanup() {
    fx.clearAll();
    if (destroyed) return;
    destroyed = true;
    restore();
    controller.abort();
    activeMounts.delete(root);
  }
  listen(window, 'pagehide', cleanup, { once: true });
  activeMounts.set(root, cleanup);
  return cleanup;
}
