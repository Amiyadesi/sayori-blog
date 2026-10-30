export const LEVEL_KEY = 'p34_anomaly_level';
export function clampLevel(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(1, Math.min(5, Math.trunc(n))) : 1; }
export function hasExitedUpward(seen, entry, scrollingDown) { return seen && scrollingDown && !entry.isIntersecting && entry.boundingClientRect.bottom <= 0; }
export function isArchiveQuery(value) { return /^(0617|p34|第34个作品)$/i.test(String(value).trim().normalize('NFKC')); }

const active = new WeakMap();
// Runs only in the explicitly selected abnormal document.
export function mountP34({ stageSelector, preservePaper = false } = {}) {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return { destroy() {}, setLevel() {}, triggerVhsGlitch() {}, playTapeNoise() {} };
  if (active.has(document.documentElement)) return active.get(document.documentElement);
  const root = document.documentElement, abort = new AbortController(), { signal } = abort;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const oldLevel = root.getAttribute('data-p34-level');
  let level = 1, manualStill = false, frame = 0, lastTick = 0, lastGlitch = -Infinity, lastSound = -Infinity;
  let glitchTimer, dollTimer, audio, closed = false;
  const surfaces = new Map(), timers = new Set();
  const later = (fn, ms) => { const timer = setTimeout(() => { timers.delete(timer); if (!closed) fn(); }, ms); timers.add(timer); return timer; };
  const motionOff = () => media.matches || manualStill;
  function readLevel() {
    let local = 1, shared = 1;
    try { local = clampLevel(localStorage.getItem(LEVEL_KEY)); } catch {}
    const cookie = document.cookie.split('; ').find(part => part.startsWith(LEVEL_KEY + '='));
    if (cookie) shared = clampLevel(cookie.slice(LEVEL_KEY.length + 1));
    return Math.max(local, shared);
  }
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/p34-organic.css?v=20261024-bio1'; style.dataset.p34Resource = '';
  document.head.append(style);
  const resources = document.createElement('div'); resources.className = 'p34-resources'; resources.setAttribute('aria-hidden', 'true');
  resources.innerHTML = `<svg class="p34-filters" width="0" height="0" xmlns="http://www.w3.org/2000/svg"><defs><filter id="p34-tissue" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.005 0.009" numOctaves="2" seed="17" result="tissue"/><feDisplacementMap in="SourceGraphic" in2="tissue" scale="0.7" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg><div class="vhs-overlay"></div><div class="vhs-tape-noise"></div><div class="vhs-grain"></div>`;
  document.body.append(resources);
  const turbulence = resources.querySelector('feTurbulence'), displacement = resources.querySelector('feDisplacementMap');
  const previousTrigger = window.triggerVhsGlitch;
  function updateLevel(value, persist = true) {
    level = clampLevel(value); root.dataset.p34Level = String(level);
    root.style.setProperty('--p34-congestion', (0.09 + level * 0.038).toFixed(3));
    if (persist) {
      try { localStorage.setItem(LEVEL_KEY, String(level)); } catch {}
      if (location.hostname === 'sayori.org' || location.hostname.endsWith('.sayori.org')) document.cookie = `${LEVEL_KEY}=${level}; Domain=.sayori.org; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
    }
    drawFilter(0);
  }
  function drawFilter(time) {
    const base = 0.005 + (level - 1) * 0.00375;
    const variation = motionOff() ? 1 : 1 + Math.sin(time * 0.00037) * 0.045;
    turbulence.setAttribute('baseFrequency', `${(base * variation).toFixed(5)} ${(base * 1.7 / variation).toFixed(5)}`);
    displacement.setAttribute('scale', motionOff() ? '0' : (0.5 + level * 0.14).toFixed(2));
  }
  function addStages() {
    for (const paper of document.querySelectorAll(stageSelector || '.paper-stage')) {
      if (surfaces.has(paper)) continue;
      const hadClass = paper.classList.contains('paper-stage'); paper.classList.add('paper-stage');
      const veins = document.createElement('div'); veins.className = 'subcutaneous-veins'; veins.setAttribute('aria-hidden', 'true');
      veins.innerHTML = `<svg viewBox="0 0 500 700" preserveAspectRatio="none"><path d="M493 -10 C438 90 477 148 421 219 S491 374 451 448 S413 610 481 710 M450 91 C389 111 420 155 369 176 M421 219 C373 226 399 281 353 294 M454 353 C395 344 412 400 373 419 M433 518 C367 513 406 577 359 601 M16 -10 C57 72 11 149 63 219 S5 364 41 441 S74 588 17 711 M37 116 L92 145 112 181 M56 252 Q104 260 89 307 M28 414 Q86 428 93 478"/><path class="p34-capillary" d="M469 48 L402 78 386 122 M434 192 L385 208 365 244 M453 401 L405 437 414 486 M45 73 L81 104 75 143 M57 324 L112 349 124 387 M41 523 L91 561 88 615"/></svg>`;
      paper.prepend(veins); surfaces.set(paper, { veins, hadClass });
    }
  }
  addStages();
  const domObserver = new MutationObserver(() => addStages()); domObserver.observe(document.body, { childList: true, subtree: true });
  const chromatic = new Map();
  for (const node of document.querySelectorAll('.page-title,.desk-brand,[data-paper-record] h1,.services-head h2')) {
    chromatic.set(node, node.classList.contains('vhs-chromatic')); node.classList.add('vhs-chromatic');
  }
  function triggerVhsGlitch(reason = 'interaction') {
    if (closed || motionOff() || document.hidden || performance.now() - lastGlitch < 2200) return false;
    lastGlitch = performance.now(); root.classList.add('p34-tracking');
    if (reason === 'doll') root.classList.add('p34-doll-drop');
    clearTimeout(glitchTimer); glitchTimer = setTimeout(() => root.classList.remove('p34-tracking', 'p34-doll-drop'), 180);
    return true;
  }
  window.triggerVhsGlitch = triggerVhsGlitch;
  function playTapeNoise() {
    if (closed || performance.now() - lastSound < 180) return;
    lastSound = performance.now();
    const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return;
    try {
      audio ||= new Context(); if (audio.state === 'suspended') void audio.resume().catch(() => {});
      const duration = 0.2, rate = audio.sampleRate, buffer = audio.createBuffer(1, Math.ceil(rate * duration), rate), data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; b0 = .99765 * b0 + white * .099046; b1 = .963 * b1 + white * .2965164; b2 = .57 * b2 + white * 1.0526913; data[i] = (b0 + b1 + b2 + white * .1848) * .12; }
      const source = audio.createBufferSource(), lowpass = audio.createBiquadFilter(), envelope = audio.createGain(), oscillator = audio.createOscillator(), motor = audio.createGain();
      source.buffer = buffer; lowpass.type = 'lowpass'; lowpass.frequency.value = 620;
      const now = audio.currentTime;
      envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(.045, now + .018); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(57, now); oscillator.frequency.linearRampToValueAtTime(43, now + duration); motor.gain.value = .18;
      source.connect(lowpass); lowpass.connect(envelope); oscillator.connect(motor); motor.connect(envelope); envelope.connect(audio.destination);
      source.start(now); source.stop(now + duration); oscillator.start(now); oscillator.stop(now + duration);
      source.onended = () => { source.disconnect(); lowpass.disconnect(); oscillator.disconnect(); motor.disconnect(); envelope.disconnect(); };
    } catch {}
  }
  function tick(time) {
    if (motionOff() || document.hidden) { syncMotion(); return; }
    frame = requestAnimationFrame(tick); if (time - lastTick < 85) return; lastTick = time; drawFilter(time);
  }
  function syncMotion() {
    cancelAnimationFrame(frame); frame = 0;
    root.classList.toggle('p34-still', motionOff());
    if (motionOff() || document.hidden) root.classList.remove('p34-tracking', 'p34-doll-drop');
    drawFilter(0); if (!motionOff() && !document.hidden) frame = requestAnimationFrame(tick);
    if (document.hidden && audio?.state === 'running') void audio.suspend().catch(() => {});
  }
  function onClick(event) {
    const node = event.target instanceof Element ? event.target.closest('a,button,summary') : null;
    if (!node) return;
    const isMusic = node.matches('.music-btn,#piano-btn');
    if (isMusic) { event.preventDefault(); event.stopImmediatePropagation(); }
    if (event.isTrusted) playTapeNoise();
    triggerVhsGlitch(node.closest('[data-paper-proof],.trace-room-record') ? 'record' : 'menu');
    if (preservePaper && node.matches('a[href]') && !node.hasAttribute('download')) {
      const url = new URL(node.href, location.href);
      if (url.origin === location.origin && !url.pathname.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(url.pathname) && !url.hash) {
        url.searchParams.set('paper', '0617'); node.href = url.href;
      }
    }
  }
  document.addEventListener('click', onClick, { capture: true, signal });
  document.addEventListener('pointerover', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.sayori-sketch,.paper-character')) return;
    if (event.relatedTarget instanceof Node && event.target.closest('.sayori-sketch,.paper-character')?.contains(event.relatedTarget)) return;
    clearTimeout(dollTimer); dollTimer = later(() => triggerVhsGlitch('doll'), 80);
  }, { signal, passive: true });
  document.addEventListener('visibilitychange', syncMotion, { signal });
  media.addEventListener('change', syncMotion, { signal });
  window.addEventListener('paper:motion', event => { manualStill = event.detail === false; syncMotion(); }, { signal });
  window.addEventListener('storage', event => { if (event.key === LEVEL_KEY) updateLevel(readLevel(), false); }, { signal });
  window.addEventListener('p34:level', event => updateLevel(event.detail), { signal });
  window.addEventListener('p34:archive-open', () => { updateLevel(Math.max(3, level)); triggerVhsGlitch('archive'); }, { signal });
  updateLevel(readLevel()); root.classList.add('p34-world'); syncMotion();
  if (new URLSearchParams(location.search).get('record') === '0617') later(() => triggerVhsGlitch('archive'), 220);
  function destroy() {
    if (closed) return; closed = true; abort.abort(); domObserver.disconnect(); cancelAnimationFrame(frame); clearTimeout(glitchTimer); clearTimeout(dollTimer); timers.forEach(clearTimeout);
    if (audio) void audio.close().catch(() => {});
    for (const [paper, { veins, hadClass }] of surfaces) { veins.remove(); if (!hadClass) paper.classList.remove('paper-stage'); }
    for (const [node, had] of chromatic) if (!had) node.classList.remove('vhs-chromatic');
    resources.remove(); style.remove(); root.classList.remove('p34-world', 'p34-still', 'p34-tracking', 'p34-doll-drop');
    if (oldLevel === null) root.removeAttribute('data-p34-level'); else root.setAttribute('data-p34-level', oldLevel);
    root.style.removeProperty('--p34-congestion'); if (window.triggerVhsGlitch === triggerVhsGlitch) { if (previousTrigger) window.triggerVhsGlitch = previousTrigger; else delete window.triggerVhsGlitch; }
    active.delete(root);
  }
  const api = { destroy, setLevel: value => updateLevel(value), triggerVhsGlitch, playTapeNoise, get level() { return level; }, get reducedMotion() { return motionOff(); } };
  active.set(root, api); return api;
}
