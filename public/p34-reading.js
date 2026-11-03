// Fullscreen girl-owned blog world for Project 34 (?paper=0617).
// Shared baseline p34 modules remain untouched and byte-identical.
import {
  WORLD_COOKIE_KEY,
  readWorldCookie,
  advanceEncounterState,
  serializeWorldState,
  createWorldSession,
} from './p34-living.js?v=20261102-r12';
import { readBreakoutCookie } from './p34-breakout-state.js?v=20261103-luminous';
import { createMotion } from './p34-motion.js?v=20261102-r12';
import { timeOfVisit, mountVisitEvents } from './p34-dialogue.js?v=20261102-r12';
import {
  HER_OWN_POSTS,
  normalizeBlogPath,
  getOwnPostBySlug,
  getOwnPostByPath,
  isOwnNotePath,
} from './p34-own-posts.js?v=20261103-luminous';

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
  if (post) {
    if (encounterType === 'blog-first') {
      return `咦，你直接翻到这一篇啦。${post.voiceRemark}`;
    }
    if (encounterType === 'blog-from-home') {
      return `从主页那边逛过来啦？${post.voiceRemark}`;
    }
    return post.voiceRemark;
  }
  if (encounterType === 'blog-first') {
    return '欢迎来读我的手记。这几篇都是我平时记下来的，挑一篇顺眼的看吧。';
  }
  if (encounterType === 'blog-from-home') {
    return '从主页那边过来啦？这边是我平时写手记的地方。';
  }
  return '又翻回这边啦。这几篇手记都在这儿，挑一篇顺眼的慢慢读就好。';
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
  const encounterType = c.encounterType || 'blog-first';
  const choices = [];

  if (post?.slug === 'prism-and-paddle') {
    choices.push(choice('talk-prism', '聊聊三棱镜和页面底下的挡板。'));
    choices.push(choice('open-corners', '去看看《左边空着就空着，别往里塞小挂件》。'));
    choices.push(choice('open-afternoon', '去看看《暂时第一名：倒汽水的声音》。'));
  } else if (post?.slug === 'empty-corners') {
    choices.push(choice('talk-corners', '聊聊左边那块空地。'));
    choices.push(choice('open-prism', '去看看《把折光拨偏一点，顺便在底下接球》。'));
    choices.push(choice('open-afternoon', '去看看《暂时第一名：倒汽水的声音》。'));
  } else if (post?.slug === 'afternoon-rankings') {
    choices.push(choice('talk-afternoon', '聊聊倒汽水的声音和那四个音。'));
    choices.push(choice('open-prism', '去看看《把折光拨偏一点，顺便在底下接球》。'));
    choices.push(choice('open-corners', '去看看《左边空着就空着，别往里塞小挂件》。'));
  } else {
    choices.push(choice('talk-prism', '聊聊《把折光拨偏一点，顺便在底下接球》。'));
    choices.push(choice('talk-corners', '聊聊《左边空着就空着，别往里塞小挂件》。'));
    choices.push(choice('talk-afternoon', '聊聊《暂时第一名：倒汽水的声音》。'));
  }

  choices.push(choice('talk-amiya', '原来的博客去哪了？'));
  choices.push(choice('visit-home', '去你的主页那边看看。'));
  choices.push(choice('return', '先回到原来的普通页面。'));

  if (c.lingered) choices.unshift(choice('linger', '刚才，你是不是想说什么？'));

  let text;
  if (post?.slug === 'prism-and-paddle') {
    text = encounterType === 'blog-from-home'
      ? '刚从主页过来就翻到这篇啦。\n本来只是嫌那束光太直，结果把三棱镜拨偏一点又支起挡板之后，每次试角度都会多打好几个回合。'
      : '这篇记的是主页那块三棱镜和底下的挡板。\n原本只想把光路拨偏一点，没想到拿光球去撞标题和卡片还挺上瘾的。';
  } else if (post?.slug === 'empty-corners') {
    text = '看见空地方就想塞小挂件，十有八九会把页面越改越乱。\n明明已经排完了，忍住别往左边硬塞东西才最要紧。';
  } else if (post?.slug === 'afternoon-rankings') {
    text = '下午不想改字，就给听见的几个声音排了个名次。\n往冰块上倒汽水的前两秒暂时排第一，突然炸响的闹钟直接除名。';
  } else if (encounterType === 'blog-from-home') {
    text = '从主页那边晃过来啦。\n这边放着我平时写的几篇手记，想先看哪一篇？';
  } else if (encounterType === 'blog-return') {
    text = '你又翻回这边啦。\n这三篇手记都在这儿，想聊哪一篇？';
  } else {
    text = '欢迎来读我的手记。\n这里记的都是我平时折腾的小东西和一点偏见。';
  }

  return { text, pose: 'rest', choices };
}

const READING_NODES = {
  root: (s, c) => blogRootNode(s, c),
  'blog-root': (s, c) => blogRootNode(s, c),
  'talk-prism': {
    text: '我嫌主页那束光太直，就把三棱镜拨偏了一点。\n后来又在底下支起挡板拿光球去撞标题和卡片，连撞五下我还会顺手帮卡片修好一处折角。',
    pose: 'unfold',
    choices: [
      choice('open-prism', '读《把折光拨偏一点，顺便在底下接球》'),
      choice('visit-home', '去主页试试接球 ↗'),
      choice('talk-corners', '聊聊《左边空着就空着，别往里塞小挂件》'),
    ],
  },
  'talk-corners': {
    text: '限时做游戏最后六个小时砍掉解谜，那是因为做不完不得不砍。\n但页面左边空着要不要放挂件是另一回事——明明已经排完了，纯粹是看着空地手痒。',
    pose: 'align',
    choices: [
      choice('open-corners', '读《左边空着就空着，别往里塞小挂件》'),
      choice('talk-afternoon', '聊聊《暂时第一名：倒汽水的声音》'),
      choice('stay', '我接着读正文。'),
    ],
  },
  'talk-afternoon': {
    text: '视频里往冰块上倒汽水的前两秒，暂时还是我的第一名。\n过了前两秒气跑掉一半就不算数了；至于那句卡住的四个音，短得根本没法搜歌名。',
    pose: 'gather',
    choices: [
      choice('open-afternoon', '读《暂时第一名：倒汽水的声音》'),
      choice('talk-prism', '聊聊《把折光拨偏一点，顺便在底下接球》'),
      choice('stay', '好，我慢慢看。'),
    ],
  },
  'talk-amiya': {
    text: '在另一面。这里是我写的。想看他的文章，我送你过去？',
    pose: 'align',
    choices: [
      choice('return', '现在回到原来的普通博客。'),
      choice('open-index', '先留在你这边看目录。'),
      choice('stay', '好，我在这边多待会儿。'),
    ],
  },
  linger: {
    text: '没什么。\n只是看你在这页停了好一会儿，猜你大概也在琢磨刚刚读到的那段话。',
    pose: 'gather',
    choices: [
      choice('stay', '嗯，还在读。'),
      choice('talk-afternoon', '跟你聊聊下午那份声音榜单。'),
    ],
  },
  'open-prism': { action: 'open-post', slug: 'prism-and-paddle', href: '/notes/prism-and-paddle/?paper=0617' },
  'open-corners': { action: 'open-post', slug: 'empty-corners', href: '/notes/empty-corners/?paper=0617' },
  'open-afternoon': { action: 'open-post', slug: 'afternoon-rankings', href: '/notes/afternoon-rankings/?paper=0617' },
  'open-index': { action: 'open-index', href: '/?paper=0617' },
  return: { action: 'return' },
  stay: { action: 'close' },
  'visit-home': { action: 'navigate', href: 'https://sayori.org/?paper=0617' },
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
  getContext = () => ({}),
}) {
  const panel = document.createElement('section');
  panel.id = 'p34-conversation';
  panel.className = 'p34-conversation p34-inline-chat';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'p34-her-line');
  panel.hidden = true;
  panel.innerHTML = `<div class="p34-dialogue-tools"><button type="button" class="p34-sound-toggle" data-p34-sound aria-pressed="false">微音：关</button><button type="button" data-dialogue="root" class="p34-change-topic" hidden>换个话题</button><button type="button" class="p34-goodbye">收起<span aria-hidden="true"> / Esc</span></button></div><div class="p34-her"><p id="p34-her-line" class="p34-her-line" aria-live="polite"></p></div><div class="p34-response"><div class="p34-answers" aria-label="你的回应"></div><nav class="p34-more" aria-label="其他话题" hidden><button type="button" data-turn="-1">上一页</button><button type="button" data-turn="1">更多话题</button></nav></div>`;
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
    soundBtn.textContent = active ? '微音：开' : '微音：关';
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
    void showNode(typeof initialNode === 'string' ? initialNode : 'root');
    void motion.animate(panel, [{ opacity: 0, translate: '0 -6px' }, { opacity: 1, translate: '0 0' }], { duration: 240 });
    motion.tone(0, true);
  }

  function close() {
    if (!talking) return;
    talking = false;
    panel.hidden = true;
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
  return `
    <li class="p34-index-item" data-p34-index-slug="${post.slug}">
      <article class="p34-index-article">
        <div class="p34-entry-meta">
          <time>${post.date}</time>
          <span class="p34-meta-sep" aria-hidden="true">·</span>
          <span>${post.kicker}</span>
        </div>
        <h2 class="p34-entry-title">
          <a href="${post.href}" data-p34-post-link="${post.slug}">${post.title}</a>
        </h2>
        <p class="p34-entry-excerpt">${post.excerpt}</p>
        <div class="p34-entry-foot">
          <a href="${post.href}" class="p34-read-link" data-p34-post-link="${post.slug}">展开全文 <span aria-hidden="true">→</span></a>
        </div>
      </article>
    </li>
  `;
}

function buildFullArticleHtml(post) {
  const others = HER_OWN_POSTS.filter(item => item.slug !== post.slug);
  const sectionsHtml = post.sections.map(section => `
    <section class="p34-prose-section">
      ${section.heading ? `<h2>${section.heading}</h2>` : ''}
      ${section.paragraphs.map(p => `<p>${p}</p>`).join('')}
    </section>
  `).join('');

  const othersHtml = others.map(item => `
    <a href="${item.href}" class="p34-next-card" data-p34-post-link="${item.slug}">
      <span class="p34-next-meta">${item.date} · ${item.kicker}</span>
      <strong class="p34-next-title">${item.title}</strong>
    </a>
  `).join('');

  return `
    <article class="p34-full-article" data-p34-article-slug="${post.slug}">
      <div class="p34-article-top">
        <a href="/?paper=0617" class="p34-back-index" data-p34-nav="index"><span aria-hidden="true">←</span> 返回手记目录</a>
        <div class="p34-entry-meta">
          <time>${post.date}</time>
          <span class="p34-meta-sep" aria-hidden="true">·</span>
          <span>${post.kicker}</span>
        </div>
      </div>
      <header class="p34-article-header">
        <h1 class="p34-article-title" tabindex="-1">${post.title}</h1>
        <p class="p34-article-lead">${post.lead}</p>
      </header>
      <div class="p34-article-prose">
        ${sectionsHtml}
      </div>
      <footer class="p34-article-footer">
        <div class="p34-next-grid" aria-label="继续阅读">
          ${othersHtml}
        </div>
        <div class="p34-footer-links">
          <a href="/?paper=0617" data-p34-nav="index">← 回到全部手记</a>
          <a href="https://sayori.org/?paper=0617" data-p34-home-link>去她住的那一面 ↗</a>
        </div>
      </footer>
    </article>
  `;
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
  if (!style.href.includes('20261103-luminous')) {
    style.href = '/p34-reading.css?v=20261103-luminous';
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

  // Construct her single coherent fullscreen blog root.
  const worldRoot = document.createElement('div');
  worldRoot.className = 'p34-own-blog';
  worldRoot.dataset.p34OwnRoot = 'true';
  worldRoot.dataset.p34View = activeSlug ? 'article' : 'index';
  worldRoot.setAttribute('data-pagefind-ignore', 'all');

  worldRoot.innerHTML = `
    <div class="p34-own-ambient" aria-hidden="true">
      <div class="p34-ambient-beam"></div>
      <div class="p34-ambient-warm"></div>
    </div>
    <header class="p34-own-masthead">
      <a href="/?paper=0617" class="p34-wordmark" data-p34-nav="index">
        <span class="p34-prism-dot" aria-hidden="true"></span>
        <span class="p34-wordmark-text">北窗偏光</span>
      </a>
      <nav class="p34-own-nav" aria-label="站点导航">
        <a href="/?paper=0617" class="p34-own-nav-link" data-p34-nav="index">手记</a>
        <a href="https://sayori.org/?paper=0617" class="p34-own-nav-link p34-own-nav-home" data-p34-home-link>去主页那边 ↗</a>
        <button type="button" class="p34-own-nav-return" data-p34-return>返回原站</button>
      </nav>
    </header>
    <div class="p34-own-layout">
      <aside class="p34-own-margin" aria-label="此刻的话">
        <div class="p34-voice-card">
          <p class="p34-voice-line" data-p34-voice-line data-p34-marker-line aria-live="polite"></p>
        </div>
        <div class="p34-inline-presence" data-p34-presence="true">
          <button type="button" class="p34-call" data-p34-call aria-controls="p34-conversation" aria-expanded="false">
            <span class="p34-prism-dot" aria-hidden="true"></span>
            <span class="p34-call-label">在这边坐会儿？跟我聊聊</span>
          </button>
        </div>
        <div class="p34-breakout-note" data-p34-breakout-note hidden></div>
      </aside>
      <div class="p34-own-stage" data-p34-stage>
        <section class="p34-index-section" data-p34-index-view aria-label="手记目录">
          <ol class="p34-editorial-list">
            ${HER_OWN_POSTS.map(post => buildIndexEntryHtml(post)).join('')}
          </ol>
        </section>
        <section class="p34-article-section-host" data-p34-article-view hidden aria-label="手记正文"></section>
      </div>
    </div>
  `;

  main.append(worldRoot);

  const voiceLineEl = worldRoot.querySelector('[data-p34-voice-line]');
  const presenceHost = worldRoot.querySelector('[data-p34-presence]');
  const callBtn = worldRoot.querySelector('[data-p34-call]');
  const callLabel = worldRoot.querySelector('.p34-call-label');
  const breakoutSlot = worldRoot.querySelector('[data-p34-breakout-note]');
  const indexViewEl = worldRoot.querySelector('[data-p34-index-view]');
  const articleViewEl = worldRoot.querySelector('[data-p34-article-view]');
  const stageEl = worldRoot.querySelector('[data-p34-stage]');
  const navIndexLinks = [...worldRoot.querySelectorAll('.p34-own-nav-link[data-p34-nav="index"]')];

  function refreshBreakoutNote() {
    if (!breakoutSlot) return;
    const breakout = readBreakoutCookie();
    const note = formatBreakoutNote(breakout, 'https://sayori.org/?paper=0617');
    if (note) {
      breakoutSlot.hidden = false;
      breakoutSlot.innerHTML = `<p class="p34-breakout-copy">${note.text}<a href="${note.linkHref}" class="p34-breakout-link">${note.linkText}</a></p>`;
    } else {
      breakoutSlot.hidden = true;
      breakoutSlot.innerHTML = '';
    }
  }
  refreshBreakoutNote();

  function syncTitleAndNav(post) {
    document.title = post ? `${post.title} · 北窗偏光` : '北窗偏光';
    for (const link of navIndexLinks) {
      if (!post) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function renderActiveView({ slug = null, encounterKind = encounter.encounterType, customVoice = null } = {}) {
    const post = slug ? getOwnPostBySlug(slug) : null;
    activeSlug = post ? post.slug : null;
    worldRoot.dataset.p34View = post ? 'article' : 'index';
    if (post) {
      indexViewEl.hidden = true;
      articleViewEl.hidden = false;
      articleViewEl.innerHTML = buildFullArticleHtml(post);
    } else {
      articleViewEl.hidden = true;
      articleViewEl.innerHTML = '';
      indexViewEl.hidden = false;
    }
    voiceLineEl.textContent = customVoice || initialVoiceCopy(post ? post.path : '/', encounterKind);
    syncTitleAndNav(post);
  }

  renderActiveView({ slug: activeSlug, encounterKind: encounter.encounterType });
  void motion.animate(worldRoot, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 280 });

  async function navigateOwnView(targetSlug = null, { push = true, animate = true, customVoice = null } = {}) {
    const post = targetSlug ? getOwnPostBySlug(targetSlug) : null;
    const nextSlug = post ? post.slug : null;
    const targetHref = post ? post.href : '/?paper=0617';
    const targetPath = post ? post.path : '/';

    if (push && normalizeBlogPath(location.pathname) !== normalizeBlogPath(targetPath)) {
      history.pushState({ p34OwnPath: targetPath }, '', targetHref);
    }

    const update = () => {
      renderActiveView({
        slug: nextSlug,
        encounterKind: 'blog-return',
        customVoice,
      });
    };

    if (animate) {
      await motion.layout([voiceLineEl, presenceHost, stageEl], update, 18);
      if (post) {
        const blocks = [...articleViewEl.querySelectorAll('.p34-article-header, .p34-prose-section p, .p34-prose-section h2')].slice(0, 8);
        blocks.forEach((el, i) => {
          void motion.animate(el, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 260, delay: i * 28 });
        });
        articleViewEl.querySelector('.p34-article-title')?.focus({ preventScroll: true });
      } else {
        const items = [...indexViewEl.querySelectorAll('.p34-index-item')];
        items.forEach((el, i) => {
          void motion.animate(el, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 240, delay: i * 36 });
        });
      }
      if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: motion.reduced() ? 'auto' : 'smooth' });
      }
    } else {
      update();
    }

    if (conversation?.talking) {
      void conversation.showNode('root');
    }
  }

  conversation = mountInlineConversation({
    root,
    host: presenceHost,
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
    }),
    onNode(_node, id) {
      if (id === 'linger') {
        lingered = false;
        callLabel.textContent = '在这边坐会儿？跟我聊聊';
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
      callLabel.textContent = '刚才，你是不是想说什么？';
      voiceLineEl.textContent = '还在读呀。要是累了，随时可以在旁边跟我搭句话。';
      motion.tone(3, true);
    },
  });

  listen(worldRoot, 'click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-p34-return]')) {
      event.preventDefault();
      void sendBack();
      return;
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
  listen(window, 'focus', refreshBreakoutNote);

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
