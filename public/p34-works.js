// Project 34 · 她做的小东西
// 三个能真玩的小作品：接光、排字、漂。
// 每个都是独立挂载，返回 destroy()，不依赖外部库。

export const WORK_META = [
  { id: 'light', title: '接住', note: '她说这是她第一个做完的。', hint: '移动鼠标或手指，接住掉下来的光点。' },
  { id: 'words', title: '排好', note: '她写字的时候总先把顺序打乱。', hint: '按顺序点字，把它排回一句话。' },
  { id: 'drift', title: '漂', note: '她说这个「还没想清楚」。', hint: '方向键或点击移动，走到亮着的那格。' },
];

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- 接住 ---------------- */
function mountLight(host, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'p34-work-canvas';
  canvas.width = 640; canvas.height = 360;
  const wrap = document.createElement('div');
  wrap.className = 'p34-work-stage';
  const scoreEl = document.createElement('p');
  scoreEl.className = 'p34-work-score';
  const tip = document.createElement('p');
  tip.className = 'p34-work-tip';
  tip.textContent = opts.hint || WORK_META[0].hint;
  wrap.append(canvas, scoreEl, tip);
  host.append(wrap);

  const ctx = canvas.getContext('2d');
  const GLYPHS = ['✦', '·', '◊', '░', '✧'];
  let raf = 0, running = true, score = 0, misses = 0, t0 = performance.now();
  const catcher = { x: canvas.width / 2, w: 96 };
  const drops = [];
  let spawnAt = 0;
  const hard = Boolean(opts.updated);

  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * canvas.width;
    catcher.x = Math.max(catcher.w / 2, Math.min(canvas.width - catcher.w / 2, x));
  }
  canvas.addEventListener('pointermove', pointer);
  canvas.addEventListener('pointerdown', pointer);

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - t0) / 1000) * (hard ? 1.35 : 1);
    t0 = now;
    const interval = hard ? 520 : 720;
    spawnAt -= dt * 1000;
    if (spawnAt <= 0) {
      spawnAt = interval;
      drops.push({ x: 30 + Math.random() * (canvas.width - 60), y: -20, vy: 70 + Math.random() * 70, g: GLYPHS[(Math.random() * GLYPHS.length) | 0] });
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#101a16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 她画的接光的那只手：一条会呼吸的横线
    const breathe = reduceMotion() ? 0 : Math.sin(now / 700) * 2;
    ctx.strokeStyle = '#9ad7c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(catcher.x - catcher.w / 2, canvas.height - 34 + breathe);
    ctx.lineTo(catcher.x + catcher.w / 2, canvas.height - 34 - breathe);
    ctx.stroke();

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.vy * dt;
      ctx.fillStyle = '#d8efe7';
      ctx.font = '20px monospace';
      ctx.fillText(d.g, d.x, d.y);
      if (d.y > canvas.height - 44 && d.y < canvas.height - 18 && Math.abs(d.x - catcher.x) < catcher.w / 2) {
        drops.splice(i, 1); score += 1;
        scoreEl.textContent = '接住 ' + score;
      } else if (d.y > canvas.height + 20) {
        drops.splice(i, 1); misses += 1;
        if (misses >= 6) return end('miss');
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function end(reason) {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    tip.textContent = reason === 'miss' ? '接丢了六个。她说这版太难，改天再调。' : '到这里就够了。';
    opts.onFinish && opts.onFinish({ score, reason });
  }

  scoreEl.textContent = '接住 0';
  raf = requestAnimationFrame(loop);
  const stop = setTimeout(() => end('time'), 42000);

  return () => { running = false; cancelAnimationFrame(raf); clearTimeout(stop); canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerdown', pointer); wrap.remove(); };
}

/* ---------------- 排好 ---------------- */
function mountWords(host, opts = {}) {
  const LINE = opts.line || '灯不需要观众';
  const chars = Array.from(LINE);
  const order = chars.map((c, i) => ({ c, i }));
  // 固定种子打乱，刷新也一样，像她自己排的
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = order.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }

  const wrap = document.createElement('div');
  wrap.className = 'p34-work-stage p34-words';
  const slots = document.createElement('div');
  slots.className = 'p34-words-slots';
  const bank = document.createElement('div');
  bank.className = 'p34-words-bank';
  const tip = document.createElement('p');
  tip.className = 'p34-work-tip';
  tip.textContent = opts.hint || WORK_META[1].hint;
  wrap.append(slots, bank, tip);
  host.append(wrap);

  const slotEls = chars.map(() => { const s = document.createElement('span'); s.className = 'p34-slot'; slots.append(s); return s; });
  let next = 0;
  const buttons = order.map(({ c }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'p34-glyph-btn';
    b.textContent = c;
    b.addEventListener('click', () => {
      if (b.disabled) return;
      if (c !== chars[next]) {
        b.classList.remove('p34-wrong');
        void b.offsetWidth;
        b.classList.add('p34-wrong');
        tip.textContent = '不是这个。再看看。';
        return;
      }
      slotEls[next].textContent = c;
      slotEls[next].classList.add('p34-filled');
      b.disabled = true;
      next += 1;
      tip.textContent = next === chars.length ? '排好了。' : '对。继续。';
      if (next === chars.length) {
        opts.onFinish && opts.onFinish({ line: LINE });
      }
    });
    bank.append(b);
    return b;
  });

  return () => { wrap.remove(); };
}

/* ---------------- 漂 ---------------- */
function mountDrift(host, opts = {}) {
  const COLS = 9, ROWS = 5;
  const wrap = document.createElement('div');
  wrap.className = 'p34-work-stage p34-drift';
  const grid = document.createElement('div');
  grid.className = 'p34-drift-grid';
  grid.tabIndex = 0;
  const tip = document.createElement('p');
  tip.className = 'p34-work-tip';
  tip.textContent = opts.hint || WORK_META[2].hint;
  wrap.append(grid, tip);
  host.append(wrap);

  const walls = new Set(['3,1', '3,2', '3,3', '6,0', '6,1', '6,4']);
  const goal = { x: 8, y: 2 };
  const player = { x: 0, y: 2 };
  let moves = 0;
  const cells = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'p34-drift-cell';
    cell.dataset.x = x; cell.dataset.y = y;
    cell.addEventListener('click', () => { tryMove(x - player.x, y - player.y); });
    cells.push(cell);
    grid.append(cell);
  }
  const key = (p) => p.x + ',' + p.y;

  function paint() {
    cells.forEach((cell) => {
      const x = Number(cell.dataset.x), y = Number(cell.dataset.y);
      cell.classList.toggle('is-wall', walls.has(x + ',' + y));
      cell.classList.toggle('is-player', player.x === x && player.y === y);
      cell.classList.toggle('is-goal', goal.x === x && goal.y === y);
    });
  }
  function tryMove(dx, dy) {
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const nx = player.x + dx, ny = player.y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
    if (walls.has(nx + ',' + ny)) { tip.textContent = '这里过不去。'; return; }
    player.x = nx; player.y = ny; moves += 1;
    tip.textContent = '';
    paint();
    if (player.x === goal.x && player.y === goal.y) {
      tip.textContent = '到了。';
      opts.onFinish && opts.onFinish({ moves });
      return;
    }
    // 她手痒：每走四步挪一堵墙。只有"更新版"才这样。
    if (opts.updated && moves % 4 === 0) {
      const list = [...walls];
      walls.delete(list[(Math.random() * list.length) | 0]);
      walls.add(((Math.random() * COLS) | 0) + ',' + ((Math.random() * ROWS) | 0));
      paint();
      tip.textContent = '她把墙挪了。';
    }
  }
  grid.addEventListener('keydown', (event) => {
    const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = map[event.key];
    if (d) { event.preventDefault(); tryMove(d[0], d[1]); }
  });

  paint();
  grid.focus({ preventScroll: true });
  return () => { wrap.remove(); };
}

const MOUNTERS = { light: mountLight, words: mountWords, drift: mountDrift };

export function mountWork(id, host, opts = {}) {
  const fn = MOUNTERS[id];
  if (!fn) return () => {};
  return fn(host, opts) || (() => {});
}
