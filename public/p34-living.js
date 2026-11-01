// Project 34 · Revision 04: The Webpage Itself Is Her — Suspended Typographic Space
// Shared across sayori.org & blog.sayori.org under the ?paper=0617 gate.
// Native split-grapheme layer + Web Animations API (Element.animate) + cipher decode + suspended layout reflow.
// No doll/avatar actors, no trajectory emitters, no red-boxed floating widgets.

export const WORLD_COOKIE_KEY = 'p34_world_v1';
const VALID_SITES = new Set(['none', 'home', 'blog', 'store']);
const VALID_MOODS = new Set(['warm', 'curious', 'playful', 'shy']);
const TOKEN_PATTERN = /^v1\.(none|home|blog|store)\.([01])\.([01])\.([0-5])\.([01])\.([01])\.([01])\.(\d{1,2})\.(warm|curious|playful|shy)(?:\.(\d{1,3}))?$/;
const CIPHER_GLYPHS = ['◊', '∆', '░', '▒', '✦', '§', '0', '3', '4', '⋮'];

// 可替换的试玩台词；人物身份、动机与正式剧情由作者定稿。
export const GIRL_TEST_COPY = Object.freeze({
  first: ['啊。\n你看得见我？', '等一下，这几行字还没排好。'],
  blog: ['你也翻到\n这一页了。', '这里都是他写下的东西。我只偷偷挪动了一点。'],
  who: [
    ['先别找我。', '你正在看的，就是我能碰到的地方。'],
    ['嗯，你好。', '刚才把这里挪开了一点……没有挡住你吧？'],
    ['你可以慢慢看。', '不急。我会待在这里。'],
  ],
  request: ['可以陪我\n试一试吗？', '你翻到另一页的时候，看看还能不能认出我。'],
  meta: { authorPending: ['名字与身份', '真正的请求与目的', '正式谜题和结局'] },
});

export function createDefaultWorldState() {
  return {
    v: 1,
    first: 'none',
    hm: 0,
    bm: 0,
    st: 0,
    hk: 0,
    ba: 0,
    dc: 0,
    sc: 0,
    mood: 'warm',
    aff: 0,
  };
}

function normalizeInvariants(rawState) {
  const s = { ...createDefaultWorldState(), ...rawState };
  s.v = 1;
  s.first = VALID_SITES.has(s.first) ? s.first : 'none';
  s.hm = s.hm ? 1 : 0;
  s.bm = s.bm ? 1 : 0;
  s.hk = s.hk ? 1 : 0;
  s.ba = s.ba ? 1 : 0;
  s.dc = s.dc ? 1 : 0;
  s.sc = Number.isFinite(Number(s.sc)) ? Math.max(0, Math.min(20, Math.trunc(Number(s.sc)))) : 0;
  s.st = Number.isFinite(Number(s.st)) ? Math.max(0, Math.min(5, Math.trunc(Number(s.st)))) : 0;
  s.mood = VALID_MOODS.has(s.mood) ? s.mood : 'warm';
  s.aff = Number.isFinite(Number(s.aff)) ? Math.max(0, Math.min(100, Math.trunc(Number(s.aff)))) : 0;
  if (s.dc === 1) {
    s.ba = 1;
    s.hk = 1;
    s.st = 5;
  } else if (s.ba === 1) {
    s.hk = 1;
    s.st = Math.max(s.st, 4);
  } else if (s.hk === 1) {
    s.st = Math.max(s.st, 3);
  }
  return s;
}

export function parseWorldState(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 64) {
    return { valid: false, state: createDefaultWorldState() };
  }
  const match = raw.trim().match(TOKEN_PATTERN);
  if (!match) {
    return { valid: false, state: createDefaultWorldState() };
  }
  const [, first, hm, bm, st, hk, ba, dc, sc, mood, aff] = match;
  const state = normalizeInvariants({
    v: 1,
    first,
    hm: Number(hm),
    bm: Number(bm),
    st: Number(st),
    hk: Number(hk),
    ba: Number(ba),
    dc: Number(dc),
    sc: Number(sc),
    mood,
    aff: Number(aff || 0),
  });
  return { valid: true, state };
}

export function serializeWorldState(state) {
  const s = normalizeInvariants(state);
  return `v1.${s.first}.${s.hm}.${s.bm}.${s.st}.${s.hk}.${s.ba}.${s.dc}.${s.sc}.${s.mood}.${s.aff}`;
}

export function mergeWorldStates(a, b) {
  const sa = normalizeInvariants(a);
  const sb = normalizeInvariants(b);
  return normalizeInvariants({
    v: 1,
    first: sa.first !== 'none' ? sa.first : sb.first,
    hm: Math.max(sa.hm, sb.hm),
    bm: Math.max(sa.bm, sb.bm),
    st: Math.max(sa.st, sb.st),
    hk: Math.max(sa.hk, sb.hk),
    ba: Math.max(sa.ba, sb.ba),
    dc: Math.max(sa.dc, sb.dc),
    sc: Math.max(sa.sc, sb.sc),
    mood: sb.mood !== 'warm' ? sb.mood : sa.mood,
    aff: Math.max(sa.aff, sb.aff),
  });
}

export function readWorldCookie(cookieHeader = '') {
  try {
    const cookiePart = String(cookieHeader || '')
      .split('; ')
      .find(row => row.startsWith(WORLD_COOKIE_KEY + '='));
    if (cookiePart) {
      const cookieVal = decodeURIComponent(cookiePart.slice(WORLD_COOKIE_KEY.length + 1));
      const parsedCookie = parseWorldState(cookieVal);
      if (parsedCookie.valid) return parsedCookie.state;
    }
  } catch {}
  return createDefaultWorldState();
}

export function advanceEncounterState(state, site) {
  const current = normalizeInvariants(state);
  const targetSite = site === 'blog' ? 'blog' : site === 'store' ? 'store' : 'home';
  if (current.first === 'none') {
    const next = normalizeInvariants({
      ...current,
      first: targetSite,
      hm: targetSite === 'home' ? 1 : current.hm,
      bm: targetSite === 'blog' ? 1 : current.bm,
      st: Math.max(current.st, 1),
      aff: Math.min(100, current.aff + 3),
    });
    return { state: next, encounterType: `${targetSite}-first` };
  }
  if (targetSite === 'store') {
    const next = normalizeInvariants({
      ...current,
      sc: Math.min(20, current.sc + 1),
      st: Math.max(current.st, 1),
      aff: Math.min(100, current.aff + (current.first === 'store' ? 1 : 2)),
    });
    return { state: next, encounterType: current.first === 'store' ? 'store-return' : 'store-from-anywhere' };
  }
  if (targetSite === 'home' && current.hm === 0) {
    const next = normalizeInvariants({
      ...current,
      hm: 1,
      st: Math.max(current.st, 2),
      sc: Math.min(20, current.sc + 1),
      aff: Math.min(100, current.aff + 1),
    });
    return { state: next, encounterType: 'home-from-blog' };
  }
  if (targetSite === 'blog' && current.bm === 0) {
    const next = normalizeInvariants({
      ...current,
      bm: 1,
      st: Math.max(current.st, 2),
      sc: Math.min(20, current.sc + 1),
      aff: Math.min(100, current.aff + 1),
    });
    return { state: next, encounterType: 'blog-from-home' };
  }
  return { state: current, encounterType: `${targetSite}-return` };
}

export function applyPuzzleAction(state, action) {
  const current = normalizeInvariants(state);
  switch (action) {
    case 'explore': {
      const sc = Math.min(20, current.sc + 1);
      const st = sc >= 2 ? Math.max(current.st, 2) : current.st;
      const next = normalizeInvariants({ ...current, sc, st, aff: Math.min(100, current.aff + 1) });
      return { ok: true, unlocked: st >= 2 && current.st < 2 ? 'request' : null, state: next };
    }
    case 'find-rubbing': {
      const next = normalizeInvariants({
        ...current,
        hk: 1,
        st: Math.max(current.st, 3),
        sc: Math.min(20, current.sc + 1),
        mood: 'curious',
      });
      return { ok: true, unlocked: 'rubbing', state: next };
    }
    case 'try-blog-door': {
      if (current.hk === 0) {
        const next = normalizeInvariants({
          ...current,
          st: Math.max(current.st, 2),
          sc: Math.min(20, current.sc + 1),
          mood: 'curious',
        });
        return { ok: false, reason: 'locked-from-back', state: next };
      }
      const next = normalizeInvariants({
        ...current,
        ba: 1,
        st: Math.max(current.st, 4),
        sc: Math.min(20, current.sc + 1),
        mood: 'playful',
      });
      return { ok: true, unlocked: 'music-strip', state: next };
    }
    case 'play-desk-chime': {
      if (current.ba === 0) {
        return { ok: false, reason: 'missing-strip', state: current };
      }
      const next = normalizeInvariants({
        ...current,
        dc: 1,
        st: 5,
        sc: Math.min(20, current.sc + 1),
        mood: 'warm',
      });
      return { ok: true, unlocked: 'interleaf', state: next };
    }
    default:
      return { ok: false, reason: 'unknown-action', state: current };
  }
}

export function stepSpring(pos, vel, target = 0, stiffness = 240, damping = 18, dt = 1 / 60) {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.034);
  const force = -stiffness * (pos - target) - damping * vel;
  const nextVel = vel + force * safeDt;
  const nextPos = pos + nextVel * safeDt;
  const settled = Math.abs(nextPos - target) < 0.15 && Math.abs(nextVel) < 0.8;
  return {
    pos: settled ? target : nextPos,
    vel: settled ? 0 : nextVel,
    settled,
  };
}

export function resolveCookieDomain(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'sayori.org' || h.endsWith('.sayori.org')) return '.sayori.org';
  if (h === 'sayori.local' || h.endsWith('.sayori.local')) return '.sayori.local';
  return '';
}

/**
 * Grapheme-safe segmentation so Chinese characters, punctuation, and emojis
 * are never split mid-codepoint during visual glyph assembly.
 */
let sharedSegmenter = null;
export function segmentGraphemes(text) {
  const str = String(text ?? '');
  if (!str) return [];
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      sharedSegmenter ||= new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
      return Array.from(sharedSegmenter.segment(str), s => s.segment);
    }
  } catch {}
  return Array.from(str);
}

/**
 * Multi-directional scatter vectors distributed around 360 degrees.
 * Characters assemble from the surrounding typographic field, never from a single emitter point.
 */
export function buildScatterVector(index, total = 24, intensity = 1) {
  const safeTotal = Math.max(1, total);
  const goldenAngle = index * 2.399963229728653 + (index % 3) * 0.45;
  const ring = 0.45 + ((index * 7 + 3) % 11) / 11;
  const radiusX = (46 + ring * 88) * intensity;
  const radiusY = (32 + ring * 64) * intensity;
  const dx = Math.round(Math.cos(goldenAngle) * radiusX * 10) / 10;
  const dy = Math.round(Math.sin(goldenAngle) * radiusY * 10) / 10;
  const rot = Math.round(((index % 2 === 0 ? 1 : -1) * (10 + ((index * 13) % 26))) * intensity);
  const scale = Number((1.16 + ((index % 4) * 0.06) * intensity).toFixed(2));
  return { dx, dy, rot, scale, progressOffset: index / safeTotal };
}

/**
 * Deterministic bounded symbol-to-character decode.
 * Early progress shows cipher symbols on a subset of characters; progress >= 1 always returns exact graphemes.
 */
export function decodeCipherFrame(graphemes, progress, stepSeed = 0) {
  const list = Array.isArray(graphemes) ? graphemes : segmentGraphemes(graphemes);
  if (progress >= 1) return list.slice();
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  return list.map((ch, idx) => {
    if (!ch || /^\s+$/.test(ch)) return ch;
    const threshold = 0.18 + ((idx * 5 + 1) % 10) * 0.068;
    if (clamped >= threshold) return ch;
    const cipherIdx = (idx * 3 + stepSeed * 7 + list.length) % CIPHER_GLYPHS.length;
    return CIPHER_GLYPHS[cipherIdx];
  });
}

const activeMounts = new WeakMap();

export function mountLivingWorld({ signal: externalSignal } = {}) {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  const root = document.documentElement;
  if (activeMounts.has(root)) return activeMounts.get(root);
  if (externalSignal?.aborted) return () => {};
  const controller = new AbortController(), { signal } = controller;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const site = /^store\./.test(location.hostname) ? 'store'
    : document.querySelector('.desk-shell, #swup-container') ? 'blog' : 'home';
  let manualStill = false, closed = false, voice, currentLine, leaving = false, transition;
  let talkIndex = 0, layout = 0, requestShown = false;
  const nodes = new Set(), jobs = new Map(), animations = new Set(), timers = new Set();
  const hrefs = new Map(), referrers = new Map(), navAnimations = new Map();
  const motionOff = () => media.matches || manualStill;
  const encounter = advanceEncounterState(readWorldCookie(document.cookie), site);
  let state = encounter.state;
  const firstVisit = encounter.encounterType.endsWith('-first');
  const entering = root.dataset.p34Entry !== 'quiet';

  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); if (!closed) fn(); }, ms);
    timers.add(id);
    return id;
  }
  function sync() {
    state = mergeWorldStates(state, readWorldCookie(document.cookie));
    root.dataset.p34GirlStage = String(state.st);
    return state;
  }
  function save(next) {
    state = mergeWorldStates(readWorldCookie(document.cookie), next);
    const domain = resolveCookieDomain(location.hostname);
    document.cookie = WORLD_COOKIE_KEY + '=' + encodeURIComponent(serializeWorldState(state))
      + (domain ? '; Domain=' + domain : '') + '; Path=/; Max-Age=15552000; SameSite=Lax'
      + (location.protocol === 'https:' ? '; Secure' : '');
    root.dataset.p34GirlStage = String(state.st);
  }
  function apply(actionName) {
    sync();
    const result = applyPuzzleAction(state, actionName);
    save(result.state);
    return result;
  }
  function urlFor(href) {
    const url = new URL(href, location.href);
    if (!['sayori.org', 'blog.sayori.org'].includes(url.hostname)) return url.href;
    if (/\.[a-z\d]+$/i.test(url.pathname)) return url.href;
    url.searchParams.set('paper', '0617');
    url.searchParams.delete('p34s');
    if (location.port && location.hostname.endsWith('sayori.org')) {
      url.protocol = location.protocol;
      url.port = location.port;
    }
    return url.href;
  }
  function connectLink(a) {
    if (/^(#|mailto:|javascript:)/.test(a.getAttribute('href'))) return;
    const next = urlFor(a.href);
    if (next !== a.href) {
      if (!hrefs.has(a)) hrefs.set(a, a.getAttribute('href'));
      a.href = next;
    }
    if (['sayori.org', 'blog.sayori.org'].includes(new URL(a.href).hostname)) {
      // Full referrer only between our two sites identifies world travel without URL state tokens.
      if (!referrers.has(a)) referrers.set(a, a.getAttribute('referrerpolicy'));
      a.referrerPolicy = 'no-referrer-when-downgrade';
    }
  }
  function connectLinks() {
    for (const a of document.querySelectorAll('a[href]')) connectLink(a);
  }
  function restoreLinks() {
    for (const [el, href] of hrefs) el.setAttribute('href', href);
    for (const [el, policy] of referrers) {
      if (policy === null) el.removeAttribute('referrerpolicy'); else el.setAttribute('referrerpolicy', policy);
    }
  }
  document.addEventListener('click', event => {
    const a = event.target.closest('a[href]');
    if (a && !leaving) connectLink(a);
  }, { capture: true, signal });

  function animate(el, frames, timing) {
    if (motionOff() || document.hidden) return null;
    const animation = el.animate(frames, timing);
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  }
  function text(el, value, entrance = false) {
    if (el.textContent === value && !entrance) return;
    jobs.get(el)?.();
    if (motionOff() || document.hidden) { el.textContent = value; return; }
    if (!entrance) {
      el.textContent = value;
      animate(el, [{ opacity: .35, translate: '0 4px' }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: 'ease-out' });
      return;
    }
    const chars = segmentGraphemes(value);
    const readable = document.createElement('span');
    readable.className = 'p34-sr-only';
    readable.textContent = value;
    const visual = document.createElement('span');
    visual.className = 'p34-glyph-stage';
    visual.setAttribute('aria-hidden', 'true');
    const glyphs = chars.map(char => {
      const span = document.createElement('span');
      span.className = 'p34-glyph';
      span.textContent = char;
      if (char === '\n') span.classList.add('p34-linebreak');
      visual.append(span);
      return span;
    });
    el.replaceChildren(readable, visual);
    const localAnimations = [], localTimers = [];
    glyphs.forEach((glyph, i) => {
      if (/^\s+$/.test(chars[i])) return;
      glyph.style.width = glyph.getBoundingClientRect().width + 'px';
      const vector = buildScatterVector(i, chars.length, entrance ? 2.5 : 0.62);
      const tint = i % 3 === 0 ? '#a73176' : i % 3 === 1 ? '#168a8d' : '#5349a1';
      const a = animate(glyph, [
        { transform: 'translate(' + vector.dx + 'px,' + vector.dy + 'px) rotate(' + vector.rot + 'deg) scale(1.15)', opacity: 0.72, color: tint, filter: 'blur(1px)', textShadow: '-4px 1px #4ebdb77a,4px -1px #e58eb870' },
        { transform: 'translate(' + (vector.dx*.82) + 'px,' + (vector.dy*.82) + 'px) rotate(' + (-vector.rot*.4) + 'deg) scale(.96)', opacity: .9, color: tint, offset: .22 },
        { transform: 'translate(0,-3px) rotate(0) scale(1.02)', opacity: 1, filter: 'blur(0)', offset: 0.82 },
        { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1, color: '#202943', filter: 'blur(0)', textShadow: '0 0 transparent' },
      ], { duration: entrance ? 1700 : 640, delay: Math.min(i * (entrance ? 28 : 12), entrance ? 560 : 180), fill: 'both', easing: 'cubic-bezier(.2,.8,.2,1)' });
      if (a) localAnimations.push(a);
    });
    for (let frame = 0; frame < 6; frame++) {
      localTimers.push(later(() => {
        const decoded = decodeCipherFrame(chars, frame / 5, frame);
        glyphs.forEach((glyph, i) => { if (!/^\s+$/.test(chars[i])) glyph.textContent = i % 3 === 1 ? decoded[i] : chars[i]; });
      }, 70 + frame * (entrance ? 110 : 65)));
    }
    function finish() {
      localTimers.forEach(id => { clearTimeout(id); timers.delete(id); });
      localAnimations.forEach(a => a.cancel());
      visual.remove();
      readable.classList.remove('p34-sr-only');
      jobs.delete(el);
    }
    localTimers.push(later(finish, entrance ? 2350 : 850));
    jobs.set(el, finish);
  }
  function say(line, entrance = false) {
    if (!voice) return;
    currentLine = line;
    text(voice.headline, line[0], entrance);
    voice.body.textContent = line[1];
    animate(voice.body, [{ opacity: .2, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, easing: 'ease-out' });
  }
  function createVoice(host, compact = false) {
    const section = document.createElement('section');
    section.className = compact ? 'p34-voice p34-voice-small' : 'p34-voice';
    section.setAttribute('aria-label', '与她交谈');
    section.innerHTML = '<h2 class="p34-voice-headline" data-p34-voice-main aria-live="polite"></h2><p class="p34-voice-body" data-p34-voice-sub></p><div class="p34-choices"></div>';
    host.prepend(section);
    nodes.add(section);
    voice = { section, headline: section.querySelector('h2'), body: section.querySelector('p'), choices: section.querySelector('.p34-choices') };
    voice.headline.setAttribute('role','button'); voice.headline.setAttribute('tabindex','0');
    voice.headline.addEventListener('click',speak,{signal});
    voice.headline.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' ') {e.preventDefault();speak();} },{signal});
    return section;
  }
  // Snapshots move the real links between both layouts; no duplicate overlay site.
  async function morph(update, reverse = false) {
    if (motionOff() || document.hidden) { update(); return; }
    const elements = [...document.querySelectorAll('.entries .entry, .page-header, .desk-header, .desk-quick-links a, .post-row')].slice(0, 14);
    const greeting = reverse ? voice?.section : document.querySelector('.desk-intro-copy');
    const names = new Map(elements.map((el, i) => [el, 'p34-part-' + i]));
    if (greeting) names.set(greeting, 'p34-greeting');
    const previous = new Map([...names].map(([el]) => [el, el.style.viewTransitionName]));
    root.classList.add('p34-morph');
    root.classList.toggle('p34-morph-back', reverse);
    if (document.startViewTransition) {
      for (const [el, name] of names) el.style.viewTransitionName = name;
      transition = document.startViewTransition(() => {
        if (closed) return;
        update();
        const target = reverse ? document.querySelector('.desk-intro-copy') : voice?.section;
        if (greeting && target) { previous.set(target, target.style.viewTransitionName); target.style.viewTransitionName = 'p34-greeting'; }
      });
      // Hidden tabs may skip snapshots; a failed DOM update still rejects finished.
      transition.ready.catch(error => { if (error.name !== 'AbortError') console.error('Page transition unavailable', error); });
      try { await transition.finished; }
      finally {
        for (const [el, value] of previous) el.style.viewTransitionName = value;
        transition = null;
        root.classList.remove('p34-morph', 'p34-morph-back');
      }
    } else {
      const before = elements.map(el => el.getBoundingClientRect());
      update();
      const moving = elements.map((el, i) => {
        const next = el.getBoundingClientRect();
        return animate(el, [{ transform: `translate(${before[i].x-next.x}px,${before[i].y-next.y}px)` }, { transform: 'none' }], { duration: 1400, easing: 'cubic-bezier(.22,1,.36,1)' });
      }).filter(Boolean);
      await Promise.all(moving.map(a => a.finished.catch(() => {})));
      root.classList.remove('p34-morph', 'p34-morph-back');
    }
  }
  function choice(label, callback, href) {
    const el = document.createElement(href ? 'a' : 'button');
    if (href) el.href = urlFor(href);
    else { el.type = 'button'; el.addEventListener('click', callback, { signal }); }
    el.textContent = label;
    el.className = 'p34-choice';
    voice.choices.append(el);
    return el;
  }
  function explore() {
    apply('explore');
    if (state.st >= 2 && !requestShown) later(() => {
      if (requestShown || leaving || document.hidden || document.activeElement?.matches('input,textarea')) return;
      if (voice.section.getBoundingClientRect().bottom < 0) return;
      requestShown = true;
      say(GIRL_TEST_COPY.request);
    }, 14000);
  }
  function speak() {
    explore();
    say(GIRL_TEST_COPY.who[talkIndex++ % GIRL_TEST_COPY.who.length]);
  }
  function rearrange() {
    const nav = document.querySelector('.entries');
    if (!nav) return;
    const links = [...nav.querySelectorAll('.entry')];
    navAnimations.forEach(a => a.cancel());
    const rects = links.map(el => el.getBoundingClientRect());
    nav.dataset.layout = String(layout = (layout + 1) % 3);
    links.forEach((el, i) => {
      const next = el.getBoundingClientRect(), before = rects[i];
      const a = animate(el, [
        { transform: 'translate('+(before.x-next.x)+'px,'+(before.y-next.y)+'px) rotate('+((i%2 ? 1:-1)*3)+'deg)' },
        { transform: 'translate(0,0) rotate(0deg)' },
      ], { duration: 1000, easing: 'cubic-bezier(.22,1,.32,1)' });
      if (a) navAnimations.set(el, a);
    });
  }
  async function sendBack() {
    if (leaving) return;
    leaving = true;
    say(['好，送你回去。', '东西放回原处。下次见。']);
    const url = new URL(location.href);
    url.searchParams.delete('paper');
    url.searchParams.delete('p34s');
    if (/\/(?:project-34|p34-record)\/?$/.test(url.pathname)) url.pathname = url.pathname.replace(/(?:project-34|p34-record)\/?$/, '');
    later(async () => {
      await morph(() => {
        [...jobs.values()].forEach(f => f());
        animations.forEach(a => a.cancel());
        voice?.section.remove();
        root.classList.remove('p34-world', 'p34-ready', 'p34-still');
        restoreLinks();
        document.querySelector('.entries')?.removeAttribute('data-layout');
      }, true);
      if (!closed) {
        // Hold the restored scene across the native reload so its parser never flashes an empty desk.
        const travel = document.createElement('style');
        travel.textContent = '@view-transition{navigation:auto}';
        document.head.append(travel); nodes.add(travel);
        location.assign(url.href);
      }
    }, motionOff() ? 0 : 650);
  }
  function initialLine() {
    sync();
    if (!firstVisit && encounter.encounterType.endsWith('-return')) return ['你回来啦。', '字还记得上次的位置。慢慢看，我在。'];
    if (site === 'blog') return encounter.encounterType === 'blog-from-home' ? ['你跟过来了。', '没错，这里也是我。文章都还在，随便翻。'] : GIRL_TEST_COPY.blog;
    return encounter.encounterType === 'home-from-blog' ? ['原来你先去了那边。', '欢迎回来。这一页，也留了位置给你。'] : GIRL_TEST_COPY.first;
  }
  function setupHome() {
    const notebook = document.querySelector('.notebook-page');
    const pageContent = notebook?.querySelector('.page-content');
    if (pageContent) {
      createVoice(pageContent);
      const seam = document.createElement('button');
      seam.className = 'p34-type-seam'; seam.type = 'button'; seam.dataset.p34Seam = '';
      seam.textContent = '？'; seam.setAttribute('aria-label', '碰一下这个歪掉的问号');
      seam.addEventListener('click', () => {
        say(['咦，现在正了吗？', '只动这几个字。其他的，我好好放着。'], true);
        rearrange();
      }, { signal });
      voice.section.append(seam);
      choice('你好。', speak);
      choice('这里是谁写的？', () => {
        explore(); say(['是 Amiya_desi。', '游戏、工具、还有这些絮絮叨叨的记录，都是他做的。你想先看哪一个？']);
      });
      choice('换个排法？', () => { explore(); rearrange(); say(['这样呢？', '我有时候也会把这里搬来搬去。别担心，入口一个都没少。']); });
      const hints = [
        ['他把想到的东西，都写在那边。', '开发记录、踩过的坑，偶尔还有一点碎碎念。'],
        ['想去别的地方找他？', '这些地址都是真的。想玩游戏的话，记得看看 itch.io。'],
        ['你想认识写下这些的人。', '那就去读这封信吧。我把位置让给他。'],
        ['不只有游戏哦。', '也有能拿来用的工具。点开看看？'],
        ['这里还通向别的地方。', '工具、资料，还有他收下的许多地址。'],
        ['还有一起做过的东西。', '工作室的作品，都放在那边。'],
      ];
      const entries = [...document.querySelectorAll('.entries .entry')];
      entries.forEach((entry, i) => {
        let previewTimer;
        const show = () => {
          navAnimations.get(entry)?.cancel();
          previewTimer = later(() => { if (!voice.section.matches(':focus-within')) {
            text(voice.headline, hints[i][0]); voice.body.textContent = hints[i][1];
          } }, 180);
        };
        const leave = () => { clearTimeout(previewTimer); timers.delete(previewTimer); if (currentLine) say(currentLine); };
        entry.addEventListener('pointerenter', show, { signal });
        entry.addEventListener('pointerleave', leave, { signal });
        entry.addEventListener('focus', show, { signal });
        entry.addEventListener('blur', leave, { signal });
      });
    } else {
      const host = document.querySelector('.letter-paper') || document.querySelector('.hero-inner');
      if (host) {
        createVoice(host, true);
        const path = location.pathname;
        say(path.includes('/social') ? ['你想去哪里找他？', '这些地址，我替你留好了。'] : path.includes('/about') ? ['这一次，听他说。', '我把这一页让给他。'] : ['这些也都是他做的。', '有些是游戏，有些能直接拿来用。慢慢挑。']);
        choice('和你说说话。', speak);
        choice('回到刚才那页', null, '/?paper=0617');
        choice('去博客', null, 'https://blog.sayori.org/?paper=0617');
      }
    }
    if (pageContent) say(initialLine());
  }
  function setupBlog() {
    const intro = document.querySelector('.desk-intro');
    const article = document.querySelector('#post-container') || document.querySelector('#swup-container');
    if (intro) {
      createVoice(intro);
      choice('你好。', speak);
      choice('你在看哪篇？', () => { explore(); say(['还没挑好呢。', '这里都是他自己的记录。你选一篇，我跟你一起看。']); });
      choice('回另一页看看', null, 'https://sayori.org/?paper=0617');
      say(initialLine());
    } else if (article) {
      createVoice(article, true);
      say(['我把字放稳了。', '你读吧。读完了，再叫我。']);
      choice('你还在吗？', speak);
      choice('回到文章列表', null, '/?paper=0617');
      choice('去另一页', null, 'https://sayori.org/?paper=0617');
    }
    for (const secret of document.querySelectorAll('.secret-text')) secret.addEventListener('click', () => secret.classList.add('is-rubbed'), { signal });
  }
  function resumed() {
    sync();
  }
  window.addEventListener('focus', resumed, { signal });
  document.addEventListener('visibilitychange', () => { if(!document.hidden) resumed(); }, { signal });
  const stopMotion = () => { if (motionOff()) { transition?.skipTransition(); [...jobs.values()].forEach(f => f()); animations.forEach(a=>a.cancel()); } };
  media.addEventListener('change', stopMotion, { signal });
  window.addEventListener('paper:motion', e => { manualStill = e.detail===false; root.classList.toggle('p34-still',manualStill); stopMotion(); }, { signal });
  window.addEventListener('p34:send-back', sendBack, { signal });
  save(state);

  let style = document.querySelector('link[data-p34-living-style]');
  if (!style) {
    style = document.createElement('link'); style.rel='stylesheet'; style.href='/p34-living.css?v=20261101-r5'; style.dataset.p34LivingStyle=''; document.head.append(style);
  }
  nodes.add(style);
  function init() {
    if (closed) return;
    root.classList.add('p34-world');
    if (site==='home') setupHome(); else setupBlog();
    if (voice) choice('送我回去吧。', sendBack);
    connectLinks();
    root.classList.add('p34-ready');
  }
  function enter() {
    if (!entering || motionOff()) { init(); return; }
    // Let the authored page settle before she starts moving it.
    later(() => void morph(init), 320);
  }
  function ready() {
    if (site==='home' && document.getElementById('sticky-note') && document.body.dataset.surfaceReady!=='true') window.addEventListener('sayori:surface-ready', enter, { once:true, signal });
    else enter();
  }
  if(style.sheet) ready(); else style.addEventListener('load',ready,{once:true,signal});
  function cleanup() {
    if(closed) return;
    closed=true; controller.abort();
    transition?.skipTransition();
    [...jobs.values()].forEach(f=>f());
    animations.forEach(a=>a.cancel());
    timers.forEach(clearTimeout);
    restoreLinks();
    nodes.forEach(el=>el.remove());
    document.querySelector('.entries')?.removeAttribute('data-layout');
    document.querySelectorAll('.secret-text.is-rubbed').forEach(el=>el.classList.remove('is-rubbed'));
    root.classList.remove('p34-world','p34-living-gate','p34-ready','p34-still','p34-morph','p34-morph-back');
    delete root.dataset.p34Entry;
    delete root.dataset.p34GirlStage;
    activeMounts.delete(root);
  }
  externalSignal?.addEventListener('abort', cleanup, {once:true});
  window.addEventListener('pagehide',cleanup,{once:true,signal});
  activeMounts.set(root,cleanup);
  return cleanup;
}
