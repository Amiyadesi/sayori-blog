import { mountP34 } from './p34-organic.js?v=20261024-bio1';
import { mountTextDecay, mountDateScramble } from './p34-decay.js?v=20261024-bio1';
// Loaded only by the blog's paper=0617 lifecycle gate.
export function mountPaperBlog() {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const root = document.documentElement;
  const stylesheet = document.createElement('link');
  stylesheet.id = 'paper-blog-css';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/paper-blog.css?v=20261024-bio1';
  document.head.append(stylesheet);
  root.classList.add('blog-altered');
  const runtime = mountP34({ stageSelector: '.desk-shell,.post-row,.desk-note', preservePaper: true });
  const stopDecay = mountTextDecay({ signal, setLevel: runtime.setLevel, getLevel: () => runtime.level });
  const stopDates = mountDateScramble({ signal, reducedMotion: () => runtime.reducedMotion });
  const isArchive = Boolean(document.querySelector('[data-p34-archive]'));
  if (isArchive) { runtime.setLevel(Math.max(runtime.level, 3)); runtime.triggerVhsGlitch('archive'); }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotion = () => root.classList.toggle('blog-still', reduced.matches);
  syncMotion();
  reduced.addEventListener('change', syncMotion, { signal });
  const inserted = [];
  // Swap only the original home-page doll; never insert art into article layouts.
  const doll = document.querySelector('img.desk-avatar');
  const originalDoll = doll ? ['src', 'srcset', 'sizes'].map(name => [name, doll.getAttribute(name)]) : [];
  if (doll) {
    doll.removeAttribute('srcset');
    doll.removeAttribute('sizes');
    doll.setAttribute('src', '/assets/paper/sayori-torn-display.png');
    doll.classList.add('paper-character');
  }
  let timer;
  let lastSurface;
  // Only decorative edge layers move. Text, inputs and navigation never move.
  document.addEventListener('pointerover', event => {
    if (reduced.matches || !(event.target instanceof Element)) return;
    const surface = event.target.closest('.post-row, [data-paper-record], .desk-intro');
    if (surface === lastSurface) return;
    clearTimeout(timer);
    lastSurface?.classList.remove('paper-pull');
    lastSurface = surface;
    if (surface) timer = setTimeout(() => surface.classList.add('paper-pull'), 650);
  }, { signal, passive: true });
  const proof = document.querySelector('[data-paper-proof]');
  const secondDoor = proof?.querySelector('[data-paper-second-door]');
  const signature = proof?.querySelector('[data-paper-signature]');
  const caption = proof?.querySelector('[data-paper-caption]');
  const screenshot = proof?.querySelector('svg');
  const originalCaption = caption?.textContent;
  const originalLabel = screenshot?.getAttribute('aria-label');
  const comparison = document.querySelector('[data-paper-comparison]');
  function revealAttachment() {
    runtime.setLevel(Math.max(runtime.level, 2)); runtime.triggerVhsGlitch('record');
    if (secondDoor) secondDoor.removeAttribute('display');
    if (signature) signature.textContent = '正在阅读的人';
    if (caption) caption.textContent = 'P34-0617 / 0.3.4 · 页内预览副本，两扇门。构建编号未变。';
    if (screenshot) screenshot.setAttribute('aria-label', 'P34-0617 同一视口副本：背墙一扇门，右墙出现第二扇门');
    if (comparison) comparison.hidden = false;
  }
  if (proof?.open) revealAttachment();
  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.matches('[data-paper-proof]')) return;
    details.closest('[data-paper-record]')?.classList.toggle('paper-open', details.open);
    if (details.open) revealAttachment();
  }, { signal, capture: true });
  const list = document.querySelector('#post-list-container');
  if (list) {
    // Use the server-rendered native PostCard, not a second feed or reader.
    fetch('/project-34/?paper=0617', { signal }).then(response => {
      if (!response.ok) throw new Error(`Build note: ${response.status}`);
      return response.text();
    }).then(html => {
      if (signal.aborted) return;
      const page = new DOMParser().parseFromString(html, 'text/html');
      const card = page.querySelector('#paper-note-card');
      if (!card) return;
      const node = document.importNode(card.content, true);
      const article = node.querySelector('article');
      if (article) inserted.push(article);
      list.prepend(node);
    }).catch(error => {
      if (error.name !== 'AbortError') console.warn('Build note unavailable', error);
    });
  }
  const author = document.querySelector('[data-paper-author]');
  const originalAuthor = author?.getAttribute('href');
  if (author) author.setAttribute('href', 'https://sayori.org/?paper=0617');
  return () => {
    lifecycle.abort();
    stopDecay(); stopDates(); runtime.destroy();
    clearTimeout(timer);
    lastSurface?.classList.remove('paper-pull');
    document.querySelectorAll('.paper-open').forEach(node => node.classList.remove('paper-open'));
    inserted.forEach(node => node.remove());
    if (doll) {
      for (const [name, value] of originalDoll) {
        if (value === null) doll.removeAttribute(name);
        else doll.setAttribute(name, value);
      }
      doll.classList.remove('paper-character');
    }
    if (secondDoor) secondDoor.setAttribute('display', 'none');
    if (signature) signature.textContent = 'Amiya_desi';
    if (caption) caption.textContent = originalCaption;
    if (screenshot && originalLabel) screenshot.setAttribute('aria-label', originalLabel);
    if (comparison) comparison.hidden = true;
    if (author && originalAuthor) author.setAttribute('href', originalAuthor);
    stylesheet.remove();
    root.classList.remove('blog-altered', 'blog-still');
  };
}
