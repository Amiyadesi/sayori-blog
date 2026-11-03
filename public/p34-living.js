// Shared abnormal edition. Normal routes never mount this world.
import { STORY_COOKIE, parseStory, serializeStory, migrateFromWorld, normalizeStory } from './p34-story.js?v=20261102-r12';
import { mountArc, HER_NOTES, parseSceneHash, serializeSceneHash, sceneDocumentTitle } from './p34-arc.js?v=20261102-r12';
import { createMotion, segmentGraphemes } from './p34-motion.js?v=20261102-r12';

export { HER_NOTES, parseSceneHash, serializeSceneHash, sceneDocumentTitle };
export const WORLD_COOKIE_KEY = 'p34_world_v1';
const VALID_SITES = new Set(['none', 'home', 'blog', 'store']);
const VALID_MOODS = new Set(['warm', 'curious', 'playful', 'shy']);
const TOKEN_PATTERN = /^v1\.(none|home|blog|store)\.([01])\.([01])\.([0-5])\.([01])\.([01])\.([01])\.(\d{1,2})\.(warm|curious|playful|shy)(?:\.(\d{1,3}))?$/;

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

export function createWorldSession() {
  function cookie(key, value) {
    const domain = resolveCookieDomain(location.hostname);
    document.cookie = key + '=' + encodeURIComponent(value) + (domain ? '; Domain=' + domain : '') + '; Path=/; Max-Age=15552000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  function getStory() {
    const row = document.cookie.split('; ').find(r => r.startsWith(STORY_COOKIE + '='));
    if (row) {
      try {
        const saved = parseStory(decodeURIComponent(row.slice(STORY_COOKIE.length + 1)));
        if (saved.valid) return saved.story;
      } catch (e) { if (!(e instanceof URIError)) throw e; }
    }
    return migrateFromWorld(readWorldCookie(document.cookie));
  }
  function setStory(value) {
    const story = normalizeStory(value);
    cookie(STORY_COOKIE, serializeStory(story));
    return story;
  }
  function readPlay() {
    const value = document.cookie.split('; ').find(r => r.startsWith('p34_play_v1='))?.slice(12) || '';
    const match = /^v1\.([0-4])\.([0-9a-f])$/.exec(value);
    return match ? { best: +match[1], stars: parseInt(match[2], 16) } : { best: 0, stars: 0 };
  }
  return { cookie, getStory, setStory, readPlay };
}

const activeMounts = new WeakMap();

export function mountLivingWorld() {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  const root = document.documentElement;
  if (activeMounts.has(root)) return activeMounts.get(root);
  const controller = new AbortController(), { signal } = controller;
  const motion = createMotion(signal);
  const site = document.querySelector('#swup-container') ? 'blog' : 'home';
  const main = document.querySelector(site === 'blog' ? '#swup-container' : '#main-content, main');
  if (!main) throw new Error('Project 34 needs the original main element');
  const original = document.createDocumentFragment(), parked = [];
  const originalTitle = document.title, originalURL = location.href;
  const originalState = history.state;
  const normalFrame = main.closest(site === 'blog' ? '.desk-shell' : '.desk-surface');
  const mainMark = document.createComment('normal main position');
  const timers = new Set();
  let arc, mounted = false, leaving = false, destroyed = false;
  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  function later(fn, time) {
    const id = setTimeout(() => { timers.delete(id); if (!signal.aborted) fn(); }, time);
    timers.add(id);
  }
  const { cookie, getStory, setStory, readPlay } = createWorldSession();
  function park(el) {
    if (!el || !el.isConnected || main.contains(el) || el.contains(main)) return;
    const mark = document.createComment('normal website');
    el.before(mark); el.remove(); parked.push([el, mark]);
  }
  function sourcePoints() {
    const points = [];
    for (const el of document.querySelectorAll('.entry-title, .page-title, .desk-intro h1, .desk-intro-copy p, .desk-quick-links a, .post-row h2, #post-container h1, #post-container p')) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.top > innerHeight || r.bottom < 0) continue;
      const chars = segmentGraphemes(el.textContent.trim());
      for (let i = 0; i < Math.min(chars.length, 8); i++) points.push({ x: r.x + r.width * (i + .5) / Math.min(chars.length, 8), y: r.y + r.height / 2, char: chars[i] });
    }
    return points.slice(0, 64);
  }
  function restore() {
    if (!mounted) return;
    arc.destroy(); arc = null;
    main.replaceChildren(original);
    for (const [el, mark] of parked) mark.replaceWith(el);
    parked.length = 0;
    mainMark.replaceWith(main);
    main.classList.remove('p34-host');
    root.classList.remove('p34-world', 'p34-ready', 'p34-playing', 'p34-talking');
    for (const key of ['p34Scene','p34Chapter','p34Mood','p34Site','p34Active','p34Pose','p34Moment']) delete root.dataset[key];
    document.title = originalTitle;
    mounted = false;
  }
  async function sendBack() {
    if (leaving) return;
    leaving = true;
    arc.say('好，稍等。我把这页放回去。');
    const from = arc.headline.getBoundingClientRect();
    await motion.animate(arc.page, [{ opacity: 1 }, { opacity: 0, translate: '0px -18px' }], { duration: 420 });
    if (destroyed) return;
    restore();
    const url = new URL(originalURL);
    url.searchParams.delete('paper'); url.searchParams.delete('p34s');
    if (/^#(?:space|blog|play|note-)/.test(url.hash)) url.hash = '';
    history.replaceState(originalState, '', url);
    const target = main.querySelector('.page-title, .desk-intro h1, #post-container h1');
    if (target) {
      const to = target.getBoundingClientRect();
      void motion.animate(target, [{ translate: `${from.x - to.x}px ${from.y - to.y}px`, scale: '.86' }, { translate: '0 0', scale: '1' }], { duration: 820 });
    }
    const originalTabindex = main.getAttribute('tabindex');
    main.tabIndex = -1; main.focus({ preventScroll: true });
    if (originalTabindex === null) main.removeAttribute('tabindex');
    else main.setAttribute('tabindex', originalTabindex);
    if (site === 'home') {
      // Plain HTML has no router to remount a world reached through same-document history.
      const resume = () => {
        if (new URLSearchParams(location.search).get('paper') !== '0617') return;
        window.removeEventListener('popstate', resume);
        cleanup(); root.dataset.p34Entry = 'morph'; mountLivingWorld();
      };
      window.addEventListener('popstate', resume);
      window.addEventListener('pagehide', () => window.removeEventListener('popstate', resume), { once: true });
    }
    later(cleanup, 900);
  }
  function enter() {
    if (destroyed) return;
    const beforePaper = main.getBoundingClientRect();
    const departing = root.dataset.p34Entry === 'quiet' ? [] : [...main.querySelectorAll('.entry-title, .desk-quick-links a, .post-row h2, .page-title, .desk-intro h1, #post-container h1')].slice(0, 9).map(el => {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { rect, text: el.textContent.trim(), font: style.font, color: style.color };
    }).filter(item => item.rect.width && item.rect.top < innerHeight && item.rect.bottom > 0);
    const sources = sourcePoints(), encounter = advanceEncounterState(readWorldCookie(document.cookie), site);
    let story = getStory();
    const first = !story.met;
    story = setStory({ ...story, met: 1, chapter: story.chapter === 'arrive' ? 'explore' : story.chapter });
    cookie(WORLD_COOKIE_KEY, serializeWorldState(encounter.state));
    original.append(...main.childNodes);
    main.before(mainMark); document.body.append(main);
    park(normalFrame);
    document.querySelectorAll(site === 'blog'
      ? '.desk-header, .desk-footer, .reading-toc, .reading-related, .desk-music-entry'
      : '.sayori-sketch, .desk-piano, .desk-odd-object, .side-notes-layer, .sticker-heart').forEach(park);
    main.classList.add('p34-host');
    root.classList.add('p34-world'); root.dataset.p34Site = site; root.dataset.p34Active = 'true';
    mounted = true;
    const scene = parseSceneHash(location.hash, site);
    const path = location.pathname + location.search;
    history.replaceState({ p34: path }, '', path + serializeSceneHash(scene));
    arc = mountArc({ root, site, main, motion, signal, first, getStory, setStory, readPlay, sendBack,
      initialScene: scene,
      onSceneChange(next) { history.pushState({ p34: path }, '', path + serializeSceneHash(next)); },
    });
    root.classList.add('p34-ready');
    if (root.dataset.p34Entry !== 'quiet') {
      const target = arc.headline.getBoundingClientRect(), afterPaper = main.getBoundingClientRect();
      void motion.animate(main, [
        { translate: `${beforePaper.x-afterPaper.x}px ${beforePaper.y-afterPaper.y}px`, scale: `${beforePaper.width/afterPaper.width} ${beforePaper.height/afterPaper.height}` },
        { translate: '0 0', scale: '1' },
      ], { duration: 1100 });
      for (const [i, item] of departing.entries()) {
        const ghost = document.createElement('span');
        ghost.className = 'p34-departing-text'; ghost.ariaHidden = 'true'; ghost.textContent = item.text;
        Object.assign(ghost.style, { left: item.rect.x+'px', top: item.rect.y+'px', width: item.rect.width+'px', font: item.font, color: item.color });
        document.body.append(ghost);
        signal.addEventListener('abort', () => ghost.remove(), { once: true });
        void motion.animate(ghost, [
          { translate: '0 0', scale: '1', opacity: 1 },
          { translate: `${(target.x-item.rect.x)*.3}px ${(target.y-item.rect.y)*.3-28}px`, rotate: `${i%2?9:-9}deg`, opacity: .8, offset: .45 },
          { translate: `${target.x-item.rect.x+24*i}px ${target.y-item.rect.y}px`, scale: '.15', opacity: 0 },
        ], { duration: 950, delay: i*32 }).then(() => ghost.remove());
      }
      void motion.assemble(arc.headline, arc.headline.textContent, sources);
      void motion.liftGlyphs(sources, arc.headline);
      for (const [i, plane] of [...arc.page.querySelectorAll('.p34-plane')].entries()) {
        const endRotate = getComputedStyle(plane).rotate;
        void motion.animate(plane, [
          { scale: i ? '.12' : '.7', rotate: `${i % 2 ? 34 : -24}deg`, translate: `${i % 2 ? -innerWidth * .5 : innerWidth * .3}px ${innerHeight * .24}px` },
          { scale: '1', rotate: endRotate, translate: '0 0' },
        ], { duration: 1550, delay: 80 + i * 110 });
      }
      for (const [i, node] of [...arc.page.querySelectorAll('.p34-navigation, .p34-presence, .p34-rest, .p34-note, .p34-call-place')].filter(el => el.getBoundingClientRect().width).entries()) {
        const from = sources[(i * 5) % Math.max(1, sources.length)];
        const to = node.getBoundingClientRect();
        void motion.animate(node, [
          { translate: `${from ? from.x - to.x : 0}px ${from ? from.y - to.y : 70}px`, rotate: `${i % 2 ? -5 : 5}deg`, opacity: 0 },
          { translate: '0px -6px', rotate: '0deg', opacity: 1, offset: .76 },
          { translate: '0 0', opacity: 1 },
        ], { duration: 1200, delay: 180 + i * 70 });
      }
    }
  }
  let style = document.querySelector('link[data-p34-living-style]');
  if (!style) {
    style = document.createElement('link'); style.rel = 'stylesheet';
    style.dataset.p34LivingStyle = ''; document.head.append(style);
  }
  if (!style.href.includes('20261102-r12')) style.href = '/p34-living.css?v=20261102-r12';
  if (style.sheet) later(enter, root.dataset.p34Entry === 'quiet' ? 0 : 260);
  else listen(style, 'load', () => later(enter, 260), { once: true });
  listen(style, 'error', () => { throw new Error('Project 34 stylesheet did not load'); }, { once: true });
  function sceneBack(e) {
    if (!mounted || leaving || new URLSearchParams(location.search).get('paper') !== '0617') return;
    if (e.type === 'popstate' && site === 'blog') return; // The head gate owns Astro history interception.
    void arc.applyScene(parseSceneHash(location.hash, site), { push: false });
  }
  listen(window, 'p34:history', sceneBack);
  listen(window, 'popstate', sceneBack);
  listen(window, 'p34:fold', () => { if (arc) void arc.applyScene({ view: 'blog', noteId: null }); });
  listen(window, 'p34:send-back', () => { if (arc) void sendBack(); });
  listen(window, 'focus', () => arc?.refresh());
  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    restore(); controller.abort(); timers.forEach(clearTimeout);
    delete root.dataset.p34Entry; activeMounts.delete(root);
  }
  listen(window, 'pagehide', cleanup, { once: true });
  activeMounts.set(root, cleanup);
  return cleanup;
}
