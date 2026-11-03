import { createWorldSession, readWorldCookie, advanceEncounterState, serializeWorldState, WORLD_COOKIE_KEY } from './p34-living.js?v=20261102-r12';
import { createMotion } from './p34-motion.js?v=20261102-r12';
import { openPlaySession } from './p34-play-state.js';

const margins = [
  { path: '/posts/after-gmtk/', match: '砍掉了所有的解密', text: '这段我反复看了几遍。他真的把不合适的部分砍掉了。我还想给《借道》塞第三个链接。算了，先留两个。', label: '这里我有话说' },
  { path: '/posts/blog-style-change/', match: '小卡片装饰', text: '我赞成。想说的话直接写在旁边就好了，不用给每句话盖一间小房子。不过我还想留那个能弹光点的横条。它有用。', label: '旁边有个圈' },
];
const mounts = new WeakMap();

export function mountPaperBlog() {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  if (/^\/(?:en\/|zh-hant\/)?$/.test(location.pathname)) {
    const oldNote = {
      '#blog': '/notes/',
      '#note-light-folds': '/notes/borrow-the-navigation/',
      '#note-moving-words': '/notes/arrows/',
      '#note-half-torn': '/notes/link-brake/',
      '#note-borrowed-margin': '/notes/two-links/',
    }[location.hash];
    if (oldNote || ['#space', '#play'].includes(location.hash)) {
      location.replace(oldNote ? oldNote + '?paper=0617' : 'https://sayori.org/?paper=0617');
      return () => {};
    }
  }
  const root = document.documentElement;
  if (mounts.has(root)) return mounts.get(root);
  const controller = new AbortController(), { signal } = controller, motion = createMotion(signal);
  const session = createWorldSession(), play = openPlaySession(session.cookie), added = [], links = [];
  const main = document.querySelector('#swup-container');
  if (!main) throw new Error('Project 34 needs the real blog main');
  const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { signal, ...options });
  let returnButton, mounted = false;
  function mark(el) { added.push(el); return el; }
  function enter() {
    if (signal.aborted || mounted) return; mounted = true;
    root.classList.add('p34-reading'); root.dataset.p34Active = 'true';
    const encounter = advanceEncounterState(readWorldCookie(document.cookie), 'blog');
    session.cookie(WORLD_COOKIE_KEY, serializeWorldState(encounter.state));
    for (const link of main.closest('body').querySelectorAll('a[href]')) {
      const url = new URL(link.href, location.href);
      if ((url.origin === location.origin || url.hostname === 'sayori.org') && !url.hash && !url.searchParams.has('paper') && !/\.(?:xml|png|webp|jpg|zip|pdf)$/.test(url.pathname)) {
        links.push([link, link.getAttribute('href')]); url.searchParams.set('paper', '0617'); link.href = url.href;
      }
    }
    const intro = main.querySelector('.desk-intro-copy');
    const presence = mark(document.createElement('div')); presence.className = 'p34-reading-presence';
    const line = document.createElement('button'); line.type = 'button';
    line.textContent = intro ? '我也在这儿看。' : '这里有个读到一半的人。';
    line.setAttribute('aria-expanded', 'false');
    const answer = document.createElement('div'); answer.className = 'p34-reading-answer'; answer.hidden = true;
    const text = document.createElement('p'); text.textContent = intro ? '这些文章是 Amiya 的。我的几笔记录，夹在另一页。' : '不用管我，继续读。碰到想说的，我会在段落旁边留个小圈。';
    const notes = document.createElement('a'); notes.href = '/notes/?paper=0617'; notes.textContent = '翻她的记录';
    const home = document.createElement('a'); home.href = 'https://sayori.org/?paper=0617'; home.textContent = '去试试她的《借道》';
    returnButton = document.createElement('button'); returnButton.type = 'button'; returnButton.textContent = '请你把原来的页面还给我';
    answer.append(text, notes, home, returnButton); presence.append(line, answer);
    if (intro) intro.append(presence); else main.prepend(presence);
    listen(line, 'click', () => {
      const following = [...main.children].filter(el => !el.contains(presence));
      void motion.layout(following, () => { answer.hidden = !answer.hidden; line.setAttribute('aria-expanded', String(!answer.hidden)); });
    });
    listen(returnButton, 'click', sendBack);
    for (const note of margins) {
      if (location.pathname !== note.path) continue;
      const paragraph = [...main.querySelectorAll('#post-container p')].find(p => p.textContent.includes(note.match));
      if (!paragraph) throw new Error(`Reading margin anchor not found: ${note.path}`);
      const aside = mark(document.createElement('aside')); aside.className = 'p34-margin'; aside.dataset.pagefindIgnore = 'all';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = note.label; button.setAttribute('aria-expanded', 'false');
      const comment = document.createElement('p'); comment.hidden = true; comment.textContent = note.text;
      aside.append(button, comment); paragraph.after(aside);
      listen(button, 'click', () => {
        const below = [...paragraph.parentElement.children].filter(el => el !== aside && (paragraph.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
        void motion.layout(below, () => { comment.hidden = !comment.hidden; button.setAttribute('aria-expanded', String(!comment.hidden)); });
        if (!comment.hidden) { motion.tone(1, true); const r = button.getBoundingClientRect(); motion.burst(r.right - 6, r.top + 8, '#9e84bd'); }
      });
    }
    const archive = main.querySelector('[data-p34-archive]');
    if (archive) {
      listen(archive, 'click', () => {
        play.set({ ...play.get(), archive: 1 });
        const story = session.getStory();
        session.setStory({ ...story, clues: [...new Set([...story.clues, 'old-version', 'update-log'])] });
      });
    }
    if (intro && root.dataset.p34Entry !== 'quiet') {
      void motion.assemble(line, line.textContent);
      void motion.animate(presence, [{ translate: '24px -15px', rotate: '-4deg', opacity: 0 }, { translate: '0 0', rotate: '0deg', opacity: 1 }], { duration: 1000 });
    }
  }
  function sendBack() {
    const url = new URL(location.href); url.searchParams.delete('paper'); history.replaceState(history.state, '', url);
    void motion.layout([main, ...main.querySelectorAll('.post-row')], cleanup);
  }
  function cleanup() {
    if (signal.aborted) return;
    controller.abort(); added.forEach(el => el.remove());
    for (const [link, href] of links) link.setAttribute('href', href);
    root.classList.remove('p34-reading'); delete root.dataset.p34Active; mounts.delete(root);
  }
  let style = document.querySelector('link[data-p34-reading-style]');
  if (!style) { style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/paper-blog.css?v=20261103-r13'; style.dataset.p34ReadingStyle = ''; document.head.append(style); }
  if (style.sheet) enter(); else listen(style, 'load', enter, { once: true });
  listen(style, 'error', () => { throw new Error('Project 34 reading stylesheet did not load'); }, { once: true });
  listen(window, 'p34:send-back', sendBack); mounts.set(root, cleanup); return cleanup;
}
