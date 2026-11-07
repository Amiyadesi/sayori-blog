const EASE = 'cubic-bezier(.22, 1, .36, 1)';

export function segmentGraphemes(value) {
  return Array.from(new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(value), part => part.segment);
}

export function createMotion(signal) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set(), particles = new Set(), textJobs = new WeakMap();
  let still = false, sound = false, audio;
  const reduced = () => media.matches || still;

  function animate(el, frames, options = {}) {
    if (!el || reduced() || document.hidden) return Promise.resolve();
    const a = el.animate(frames, { duration: 760, easing: EASE, fill: 'backwards', ...options });
    animations.add(a);
    return a.finished.then(() => animations.delete(a), () => animations.delete(a));
  }

  function layout(elements, update, stagger = 32) {
    const valid = elements.filter(Boolean);
    const before = valid.map(el => ({ rect: el.getBoundingClientRect(), width: el.offsetWidth, height: el.offsetHeight, rotate: getComputedStyle(el).rotate }));
    update();
    for (const el of valid) {
      el.getAnimations?.().forEach(a => {
        if (animations.has(a)) {
          a.cancel();
          animations.delete(a);
        }
      });
    }
    if (reduced() || document.hidden) return Promise.resolve();
    const small = typeof innerWidth === 'number' && innerWidth <= 640;
    return Promise.all(valid.map((el, i) => {
      const after = el.getBoundingClientRect(), from = before[i], angle = getComputedStyle(el).rotate;
      if (!from.rect.width || !after.width) return Promise.resolve();
      const dx = from.rect.x - after.x, dy = from.rect.y - after.y;
      const sx = from.width && el.offsetWidth ? from.width / el.offsetWidth : 1;
      const sy = from.height && el.offsetHeight ? from.height / el.offsetHeight : 1;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01 && angle === from.rotate) return Promise.resolve();
      const rotate = angle === 'none' ? '0deg' : angle;
      return animate(el, [
        { translate: `${dx}px ${dy}px`, rotate: from.rotate === 'none' ? '0deg' : from.rotate, scale: `${sx} ${sy}` },
        { translate: `${-dx * .012}px ${-dy * .012}px`, rotate, scale: '1', offset: .88 },
        { translate: '0px 0px', rotate, scale: '1' },
      ], { duration: small ? 860 : 1100, delay: i * stagger, easing: EASE });
    }));
  }

  async function assemble(el, value, sources = null) {
    if (!el) return;
    const token = Symbol(); textJobs.set(el, token);
    el.textContent = value;
    if (reduced() || document.hidden) return;
    const readable = document.createElement('span');
    readable.className = 'p34-sr-only';
    readable.textContent = value;
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    const glyphs = segmentGraphemes(value);
    const letters = glyphs.map((char, i) => {
      if (char === '\n') { visual.append(document.createElement('br')); return null; }
      const letter = document.createElement('span');
      letter.className = 'p34-letter';
      letter.textContent = char;
      visual.append(letter);
      return { letter, i };
    }).filter(Boolean);
    el.replaceChildren(readable, visual);
    const hostRect = el.getBoundingClientRect();
    const targetCx = hostRect.left + hostRect.width / 2;
    const targetCy = hostRect.top + hostRect.height / 2;
    const small = typeof innerWidth === 'number' && innerWidth <= 640;
    const maxX = small ? 68 : 380;
    const maxY = small ? 48 : 280;

    await Promise.all(letters.map(({ letter, i }) => {
      let x, y;
      if (Array.isArray(sources) && sources.length) {
        const src = sources[i % sources.length];
        const jitterX = ((i * 37) % 40) - 20;
        const jitterY = ((i * 23) % 28) - 14;
        x = Math.max(-maxX, Math.min(maxX, src.x - targetCx + jitterX));
        y = Math.max(-maxY, Math.min(maxY, src.y - targetCy + jitterY));
      } else {
        const angle = i * 2.15 - 0.8;
        const radius = (small ? 36 : 64) + (i % 5) * (small ? 10 : 18);
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * (radius * 0.72) - 10;
      }
      const rot = (i % 2 ? 1 : -1) * (14 + (i % 4) * 6);
      const midLift = (i % 2 ? -1 : 1) * (small ? 10 : 20);
      return animate(letter, [
        { translate: `${x.toFixed(1)}px ${y.toFixed(1)}px`, rotate: `${rot}deg`, scale: '0.84', opacity: 0, filter: 'blur(2px)', color: '#4daec6' },
        { translate: `${(x * 0.68).toFixed(1)}px ${(y * 0.68 - 10).toFixed(1)}px`, rotate: `${(rot * 0.55).toFixed(1)}deg`, scale: '0.95', opacity: 0.88, filter: 'blur(0px)', color: '#6b5694', offset: 0.24 },
        { translate: `${(x * 0.24).toFixed(1)}px ${(y * 0.24 + midLift).toFixed(1)}px`, rotate: `${(-rot * 0.2).toFixed(1)}deg`, scale: '1.04', opacity: 0.96, color: '#7d64a8', offset: 0.62 },
        { translate: '0px 2px', rotate: '0deg', scale: '1', opacity: 1, offset: 0.88 },
        { translate: '0px 0px', rotate: '0deg', scale: '1', opacity: 1, color: 'inherit' },
      ], { duration: small ? 820 : 980, delay: i * 24, easing: EASE });
    }));
    if (textJobs.get(el) === token && el.contains(visual)) el.textContent = value;
  }

  function liftGlyphs(sources, targetEl) {
    if (reduced() || document.hidden || !Array.isArray(sources) || !sources.length || !targetEl) return Promise.resolve();
    const small = typeof innerWidth === 'number' && innerWidth <= 640;
    const target = targetEl.getBoundingClientRect();
    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    const jobs = [];
    const count = Math.min(small ? 8 : 16, sources.length * 2);
    for (let i = 0; i < count; i++) {
      const src = sources[i % sources.length];
      if (!src?.char) continue;
      const g = document.createElement('span');
      g.className = 'p34-lifted-glyph';
      g.setAttribute('aria-hidden', 'true');
      g.textContent = src.char;
      const startX = small ? tx + Math.max(-80, Math.min(80, src.x - tx)) : src.x;
      const startY = small ? ty + Math.max(-60, Math.min(60, src.y - ty)) : src.y;
      g.style.left = `${startX}px`;
      g.style.top = `${startY}px`;
      document.body.append(g);
      particles.add(g);
      const dx = tx - startX + (((i * 29) % 70) - 35);
      const dy = ty - startY + (((i * 19) % 44) - 22);
      const arcX = dx * 0.48 + (i % 2 ? 24 : -24);
      const arcY = dy * 0.42 - (small ? 16 : 28) - (i % 3) * 10;
      const rot = (i % 2 ? 1 : -1) * (20 + (i % 4) * 10);
      jobs.push(
        animate(g, [
          { transform: 'translate(-50%, -50%) scale(0.95) rotate(0deg)', opacity: 0 },
          { transform: `translate(calc(-50% + ${(dx * 0.12).toFixed(1)}px), calc(-50% - 12px)) scale(1.05) rotate(${(rot * 0.4).toFixed(1)}deg)`, opacity: 0.76, offset: 0.18 },
          { transform: `translate(calc(-50% + ${arcX.toFixed(1)}px), calc(-50% + ${arcY.toFixed(1)}px)) scale(0.92) rotate(${rot}deg)`, opacity: 0.62, offset: 0.58 },
          { transform: `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) scale(0.35) rotate(0deg)`, opacity: 0 },
        ], { duration: (small ? 720 : 860) + (i % 4) * 60, delay: i * 16, easing: EASE }).then(() => {
          g.remove();
          particles.delete(g);
        })
      );
    }
    return Promise.all(jobs);
  }

  async function decode(el, value) {
    if (!el) return;
    const token = Symbol(); textJobs.set(el, token);
    const glyphs = segmentGraphemes(value), symbols = ['◌', '∴', '◇', '〰', '⁝', '✦'];
    for (let step = 0; step < 6 && !signal.aborted; step++) {
      if (textJobs.get(el) !== token) return;
      if (reduced() || document.hidden) break;
      el.textContent = glyphs.map((g, i) => (g === ' ' || i / glyphs.length < step / 5 ? g : symbols[(i + step) % symbols.length])).join('');
      await new Promise(resolve => setTimeout(resolve, 46));
    }
    if (!signal.aborted && textJobs.get(el) === token) el.textContent = value;
  }

  function burst(x, y, color = '#55b8d0') {
    if (reduced() || document.hidden) return;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('i');
      p.className = 'p34-spark';
      p.style.cssText = `left:${x}px;top:${y}px;background:${i % 3 === 0 ? '#f3d778' : i % 2 ? color : '#b79dd8'}`;
      document.body.append(p);
      particles.add(p);
      const angle = (i * Math.PI * 2) / 12 + (i % 2) * 0.2, d = 20 + (i % 4) * 12;
      animate(p, [
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
        { transform: `translate(${Math.cos(angle) * d * 0.45}px,${Math.sin(angle) * d * 0.45}px) scale(1)`, opacity: 0.95, offset: 0.2 },
        { transform: `translate(${Math.cos(angle) * d}px,${Math.sin(angle) * d + 14}px) rotate(${i * 42}deg) scale(.1)`, opacity: 0 },
      ], { duration: 580 + (i % 3) * 90, easing: 'cubic-bezier(.16,.72,.28,1)' }).then(() => {
        p.remove();
        particles.delete(p);
      });
    }
  }

  function tone(note = 0, soft = false) {
    if (!sound || document.hidden) return;
    audio ||= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime, frequency = [523.25, 587.33, 659.25, 783.99, 880, 1046.5][Math.abs(note) % 6];
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(soft ? 0.024 : 0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.56);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  function impact(kind = 'brick', pitch = 0) {
    if (!sound || document.hidden) return;
    audio ||= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const shape = { brick:[680,160,.075,'triangle'], paddle:[330,110,.09,'sine'], bomb:[150,38,.23,'triangle'], laser:[1700,90,.32,'sawtooth'], boost:[470,1150,.13,'triangle'], wall:[360,240,.04,'sine'] }[kind];
    const now=audio.currentTime, oscillator=audio.createOscillator(), gain=audio.createGain(), filter=audio.createBiquadFilter();
    oscillator.type=shape[3];oscillator.frequency.setValueAtTime(shape[0]*(1+pitch*.055),now);oscillator.frequency.exponentialRampToValueAtTime(shape[1],now+shape[2]);
    filter.type='lowpass';filter.frequency.value=kind==='laser'?2100:3200;
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='bomb'?.13:.075,now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+shape[2]);
    oscillator.connect(filter);filter.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+shape[2]+.01);
    oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();gain.disconnect();};
  }

  function stop() { animations.forEach(a => a.cancel()); }
  media.addEventListener('change', () => { if (reduced()) stop(); }, { signal });
  window.addEventListener('paper:motion', e => { still = e.detail === false; if (reduced()) stop(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden && audio?.state === 'running') void audio.suspend(); }, { signal });
  signal.addEventListener('abort', () => { stop(); particles.forEach(p => p.remove()); if (audio) void audio.close(); }, { once: true });

  return {
    animate, layout, assemble, liftGlyphs, decode, burst, tone, impact, reduced, cancelText(el) { textJobs.delete(el); },
    get sound() { return sound; },
    setSound(value) { sound = value; if (sound) tone(0, true); },
  };
}
