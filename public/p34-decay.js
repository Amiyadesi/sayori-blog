import { hasExitedUpward } from './p34-organic.js?v=20261024-bio1';

export function replaceDecayWord(text, from, to, random = Math.random) {
  return from && to && text.includes(from) && random() < 0.4 ? text.replace(from, to) : text;
}

export function mountTextDecay({ signal, setLevel, getLevel, random = Math.random } = {}) {
  const records = new Map();
  let lastScroll = scrollY, scrollingDown = false;
  const rememberScroll = () => { scrollingDown = scrollY > lastScroll; lastScroll = scrollY; };
  window.addEventListener('scroll', rememberScroll, { signal, passive: true });
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.get(entry.target); if (!record || record.done) continue;
      if (entry.isIntersecting) { record.seen = true; continue; }
      if (!hasExitedUpward(record.seen, entry, scrollingDown)) continue;
      const node = entry.target;
      const changed = replaceDecayWord(record.original, node.dataset.decayFrom || '', node.dataset.decayTo || '', random);
      if (changed !== record.original) {
        node.textContent = changed; node.dataset.decayed = 'true'; record.done = true;
        setLevel?.(Math.min(5, (getLevel?.() || 1) + 1));
      }
    }
  }, { threshold: [0, 0.05, 1] }) : null;
  for (const node of document.querySelectorAll('.decay-text[data-decay-from][data-decay-to]')) {
    // Only authored leaf paragraphs, never arbitrary real post markup.
    if (node.children.length) continue;
    records.set(node, { original: node.textContent, seen: false, done: false }); observer?.observe(node);
  }
  return () => { observer?.disconnect(); window.removeEventListener('scroll', rememberScroll); for (const [node, record] of records) { node.textContent = record.original; node.removeAttribute('data-decayed'); } };
}

export function mountDateScramble({ signal, reducedMotion = () => false } = {}) {
  const running = new Map();
  function finish(node) { const job = running.get(node); if (!job) return; clearInterval(job.interval); clearTimeout(job.timeout); node.textContent = job.original; node.removeAttribute('data-p34-dating'); running.delete(node); }
  function start(node) {
    if (reducedMotion() || running.has(node)) return;
    const original = node.textContent;
    if (!original?.trim()) return;
    node.dataset.p34Dating = 'true';
    const interval = setInterval(() => { if (reducedMotion()) { finish(node); return; } node.textContent = `${1970 + Math.floor(Math.random() * 70)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`; }, 65);
    running.set(node, { original, interval, timeout: setTimeout(() => finish(node), 500) });
  }
  const over = event => { const node = event.target instanceof Element ? event.target.closest('.post-row-meta time,.post-row time,[data-paper-record] time') : null; if (node && !(event.relatedTarget instanceof Node && node.contains(event.relatedTarget))) start(node); };
  document.addEventListener('pointerover', over, { signal, passive: true });
  return () => { document.removeEventListener('pointerover', over); for (const node of running.keys()) finish(node); };
}
