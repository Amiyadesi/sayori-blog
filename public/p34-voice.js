/* Project 34 · store 页的"她"
   不引入外部特效库：页面就是她的身体，文字就是她的表达。
   三种原生效果，全部可被 prefers-reduced-motion 关闭。 */

const GLYPHS = ['◊', '∆', '░', '▒', '✦', '§', '0', '3', '4', '⋮', '|', '/'];

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const raf = (fn) => requestAnimationFrame(fn);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* 1. 文字组装：先用噪声字占位，再逐字落回原句 */
export async function assembleText(el, opts = {}) {
  if (!el || reduce()) return;
  const original = opts.text ?? el.textContent;
  const chars = Array.from(original);
  const steps = opts.steps ?? 14;
  const total = opts.duration ?? 720;

  for (let s = 0; s <= steps; s++) {
    const settle = s / steps;
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
      // 从左到右落定，末尾保留一点噪声
      const threshold = i / chars.length;
      if (settle > threshold + 0.12) out += ch;
      else if (Math.random() < 0.85) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      else out += ch;
    }
    el.textContent = out;
    await wait(total / steps);
  }
  el.textContent = original;
}

/* 2. 像素溶解：一块区域按噪声顺序碎成方格，再消失 */
export function pixelDissolve(el, opts = {}) {
  if (!el || reduce()) return Promise.resolve();
  const cell = opts.cell ?? 12;
  const duration = opts.duration ?? 620;
  const rect = el.getBoundingClientRect();
  const w = Math.max(1, Math.ceil(rect.width / cell));
  const h = Math.max(1, Math.ceil(rect.height / cell));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.className = 'her-dissolve';
  canvas.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:60;image-rendering:pixelated;`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const order = new Float32Array(w * h);
  for (let i = 0; i < order.length; i++) order[i] = Math.random();
  const start = performance.now();
  const bg = opts.color ?? '#1b2838';

  return new Promise((done) => {
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      // 0 → 0.95 → 0：碎一下再拼回来，不是把内容吃掉
      const alpha = Math.sin(Math.PI * t) * 0.95;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = bg;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          // 噪声阈值：先碎散的格子，再整片
          const edge = 0.35 + order[i] * 0.65;
          if (t * 1.12 < edge) continue;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      if (alpha > 0.25) {
        const band = Math.max(1, Math.round(h * 0.06));
        const y0 = Math.floor((0.5 + Math.sin(t * 9) * 0.35) * (h - band));
        ctx.globalAlpha = (alpha - 0.25) * 0.5;
        ctx.fillStyle = '#7fa9a3'; ctx.fillRect(0, y0, w, band);
        ctx.fillStyle = '#c39ab4'; ctx.fillRect(0, Math.min(h - band, y0 + band), w, Math.max(1, band >> 1));
      }
      ctx.globalAlpha = 1;
      if (t < 1) raf(frame);
      else { canvas.remove(); done(); }
    }
    raf(frame);
  });
}

/* 3. 扫描线关屏：整块像旧显示器一样压成一条线 */
export function scanlineOff(el, opts = {}) {
  if (!el || reduce()) return Promise.resolve();
  const duration = opts.duration ?? 520;
  return new Promise((done) => {
    const anim = el.animate([
      { clipPath: 'inset(0 0 0 0)', filter: 'brightness(1)' },
      { clipPath: 'inset(46% 0 46% 0)', filter: 'brightness(1.6)' },
      { clipPath: 'inset(49.6% 0 49.6% 0)', filter: 'brightness(2.2)' },
      { clipPath: 'inset(50% 0 50% 0)', filter: 'brightness(2.4)', opacity: 1 },
    ], { duration, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' });
    anim.finished.then(() => {
      anim.cancel();
      done();
    });
  });
}

/* 4. 字距呼吸：标题的气口，随好感变明显 */
export function breatheHeading(el, strength = 1) {
  if (!el || reduce() || !el.animate) return null;
  return el.animate([
    { letterSpacing: '0.02em' },
    { letterSpacing: `${0.02 + 0.012 * strength}em` },
    { letterSpacing: '0.02em' },
  ], { duration: 7200, iterations: Infinity, easing: 'ease-in-out' });
}

/* 调度：隔一阵挑一件事做，玩家刚动过就不打扰 */
export function scheduleHer(moments, { min = 18000, max = 38000, quiet = 9000 } = {}) {
  let last = performance.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    addEventListener(ev, () => { last = performance.now(); }, { passive: true }));

  const run = () => {
    setTimeout(() => {
      if (!document.hidden && !reduce() && performance.now() - last > quiet) {
        const fn = moments[(Math.random() * moments.length) | 0];
        try { fn(); } catch {}
      }
      run();
    }, min + Math.random() * (max - min));
  };
  run();
}


/* 5. 她说话：把一句话组装到指定元素上，说完还原 */
export async function sayLine(el, line, opts = {}) {
  if (!el || reduce()) return;
  const keep = el.dataset.herHold || el.textContent;
  el.dataset.herHold = keep;
  el.classList.add('her-speaking');
  el.textContent = line;
  await assembleText(el, { duration: opts.assemble ?? 620, steps: opts.steps ?? 10 });
  await wait(opts.hold ?? 2600);
  el.textContent = keep;
  el.classList.remove('her-speaking');
}

/* 6. 不平静：几块内容同时被推开、错位、再被按回去 */
export function unrest(blocks, opts = {}) {
  if (reduce()) return Promise.resolve();
  const list = [].slice.call(blocks).filter((el) => el && el.animate);
  if (!list.length) return Promise.resolve();
  const strength = opts.strength ?? 1;
  const jobs = list.map((el, i) => {
    const dir = i % 2 ? -1 : 1;
    const dx = dir * (6 + Math.random() * 10) * strength;
    const dy = (Math.random() - 0.5) * 14 * strength;
    const rot = dir * (0.4 + Math.random() * 0.7) * strength;
    return el.animate([
      { transform: 'translate(0,0) rotate(0)' },
      { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, offset: 0.22 },
      { transform: `translate(${-dx * 0.45}px,${-dy * 0.4}px) rotate(${-rot * 0.5}deg)`, offset: 0.58 },
      { transform: 'translate(0,0) rotate(0)' },
    ], {
      duration: 900 + Math.random() * 420,
      delay: i * 28,
      easing: 'cubic-bezier(.2,.7,.2,1)',
    }).finished;
  });
  return Promise.all(jobs);
}
