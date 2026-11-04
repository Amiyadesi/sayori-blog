export const INITIAL_LIGHT = [[.12, .68], [.39, .37], [.64, .65], [.88, .32]];

export function lightPoint(points, t) {
  const p = Math.min(.999999, Math.max(0, t)) * (points.length - 1);
  const i = Math.floor(p), u = p - i;
  return [0, 1].map(axis => {
    const a = points[Math.max(0, i - 1)][axis], b = points[i][axis];
    const c = points[i + 1][axis], d = points[Math.min(points.length - 1, i + 2)][axis];
    return .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  });
}

export function readSketches(raw) {
  if (!raw) return [];
  let rows;
  try { rows = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row?.version === 1 && Number.isFinite(row.at) && row.at >= 0 && row.at <= 8.64e15 &&
    Array.isArray(row.nodes) && row.nodes.length === 4 && row.nodes.every(p =>
      Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= .04 && n <= .96)
    )).slice(-8);
}

const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;

export function createLightSpace(canvas, { signal, reduced }) {
  const output = canvas.getContext('2d', { alpha: false });
  if (!output) throw new Error('Light space requires Canvas 2D');
  let ctx = output;
  const atmosphere = document.createElement('canvas');
  const bg = atmosphere.getContext('2d');
  const scenery = document.createElement('canvas'), previous = document.createElement('canvas'), experiment = document.createElement('canvas');
  const sceneryContext = scenery.getContext('2d'), previousContext = previous.getContext('2d'), experimentContext = experiment.getContext('2d');
  let w = 0, h = 0, dpr = 1, frame = 0, last = 0, until = 0;
  let room = 'home', presence = 1, blend = 1, bend = 0, rigDirty = true;
  let pointer = [0, 0], targetPointer = [0, 0];
  let nodes = INITIAL_LIGHT.map(p => [...p]), rig = null;
  let snapshot = null, displayedSnapshot = null;
  let particles = [];

  function glow(context, x, y, radius, color, alpha = 1) {
    const g = context.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(100,150,240,0)');
    context.globalAlpha = alpha;
    context.fillStyle = g;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.globalAlpha = 1;
  }

  function paintAtmosphere() {
    atmosphere.width = Math.round(w * dpr); atmosphere.height = Math.round(h * dpr);
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reading = room === 'blog';
    const g = bg.createLinearGradient(0, 0, w * .3, h);
    g.addColorStop(0, '#23365b'); g.addColorStop(.44, reading ? '#2b426b' : '#38558d');
    g.addColorStop(.78, reading ? '#314c7b' : '#607fc0'); g.addColorStop(1, reading ? '#3d5a88' : '#a8beec');
    bg.fillStyle = g; bg.fillRect(0, 0, w, h);
    glow(bg, w * .82, h * .08, w * .62, '#7778c147');
    glow(bg, w * .68, h * .71, w * .5, '#91d1f622');
    glow(bg, w * .04, h * .96, w * .32, '#d8c6f666');
    bg.save(); bg.scale(1, .35);
    for (let i = 0; i < 7; i++) glow(bg, w * (i / 6), h * 2.8 + Math.sin(i * 3) * 24, w * .17, i % 2 ? '#d1d6ff69' : '#bfdbff55');
    bg.restore();
    const floor = bg.createLinearGradient(0, h * .75, 0, h);
    floor.addColorStop(0, '#bdd9ff00'); floor.addColorStop(.08, '#c4dbff18');
    floor.addColorStop(.14, '#9ce5fa25'); floor.addColorStop(1, '#99b2df06');
    bg.fillStyle = floor; bg.fillRect(0, h * .75, w, h * .25);
    for (let i = 0; i < 66; i++) {
      const y = h * (.79 + (i / 66) ** 2 * .21);
      const g = bg.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#d9e8ff00'); g.addColorStop(.58, `rgba(203,228,255,${.025 + (i % 3) * .016})`); g.addColorStop(1, '#d9e8ff00');
      bg.strokeStyle = g; bg.lineWidth = .7;
      bg.beginPath(); bg.moveTo(0, y); bg.bezierCurveTo(w * .3, y - 6, w * .7, y + 4, w, y); bg.stroke();
    }
    // Cloud banks are painted once; they never need a background animation loop.
    for (let i = 0; i < (reading ? 0 : 46); i++) {
      const side = i % 2, x = side ? w * (.84 + Math.sin(i * 2.4) * .18) : w * (.07 + Math.sin(i * 1.9) * .16);
      const y = h * (.97 + Math.sin(i * .7) * .06), radius = h * (.026 + (i % 7) * .006);
      bg.save(); bg.translate(x, y); bg.scale(1.65, 1);
      glow(bg, 0, 0, radius, i % 3 ? '#d9e2ff99' : '#f5e0ff99', .6);
      glow(bg, 0, -radius * .18, radius * .6, '#f2efff66', .4);
      bg.restore();
    }
  }

  function ribbon(path, width, seed, alpha = 1) {
    const steps = ctx === experimentContext ? (w < 600 ? 40 : 64) : (w < 600 ? 68 : 106);
    const edges = [[], []];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, p = path(t), q = path(Math.min(1, t + .002));
      const angle = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
      const breadth = width * (.18 + Math.sin(t * Math.PI) * .82) * Math.sin(t * TAU * 1.15 + seed);
      edges[0].push([p[0] + Math.cos(angle) * breadth, p[1] + Math.sin(angle) * breadth]);
      edges[1].push([p[0] - Math.cos(angle) * breadth * .32, p[1] - Math.sin(angle) * breadth * .32]);
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = alpha;
    const a = edges[0][0], b = edges[0][steps];
    const grad = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    grad.addColorStop(0, '#84cfff00'); grad.addColorStop(.16, '#b29bff66');
    grad.addColorStop(.32, '#48c8fff0'); grad.addColorStop(.45, '#df9fffff');
    grad.addColorStop(.49, '#fff1eaff'); grad.addColorStop(.53, '#81e1ffff');
    grad.addColorStop(.77, '#b2a6ffc0'); grad.addColorStop(1, '#a1baff00');
    const bands = ctx === experimentContext ? 8 : 16;
    for (let band = 0; band < bands; band++) {
      const low = band / bands, high = (band + 1) / bands;
      ctx.beginPath();
      edges[0].forEach((p, i) => {
        const x = mix(p[0], edges[1][i][0], low), y = mix(p[1], edges[1][i][1], low);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      for (let i = steps; i >= 0; i--) ctx.lineTo(mix(edges[0][i][0], edges[1][i][0], high), mix(edges[0][i][1], edges[1][i][1], high));
      ctx.closePath(); ctx.fillStyle = grad;
      ctx.globalAlpha = Math.min(1, alpha * (.08 + .6 * Math.pow(Math.abs(low - .5) * 2, 3) + .75 * Math.exp(-Math.pow((low - .27) * 15, 2))));
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath(); edges[k].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = grad; ctx.lineWidth = k ? .8 : 1.7;
      ctx.shadowBlur = k ? 0 : 12; ctx.shadowColor = '#b6c7ff'; ctx.stroke(); ctx.shadowBlur = 0;
    }
    for (const t of [.32, .51]) {
      const p = edges[0][Math.round(t * steps)];
      ctx.globalAlpha = alpha * .75;
      const halo = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 21);
      halo.addColorStop(0, t < .4 ? '#dcfaffbb' : '#ffe4ff99'); halo.addColorStop(.15, '#b0d7ff55'); halo.addColorStop(1, '#b5d8ff00');
      ctx.fillStyle = halo; ctx.fillRect(p[0] - 21, p[1] - 21, 42, 42);
      ctx.strokeStyle = '#e5faff99'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(p[0] - 7, p[1] + 2); ctx.lineTo(p[0] + 7, p[1] - 2); ctx.stroke();
    }
    // Fine longitudinal strands make a refractive surface, not a thick glowing stroke.
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      edges[0].forEach((p, i) => {
        const x = mix(p[0], edges[1][i][0], k / 4), y = mix(p[1], edges[1][i][1], k / 4);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.globalAlpha = alpha * .11; ctx.lineWidth = .5; ctx.stroke();
    }
    ctx.restore();
  }

  function prism(x, y, size, tilt, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(-size, 0, size, size);
    g.addColorStop(0, '#90bdff00'); g.addColorStop(.44, '#9edfff0a');
    g.addColorStop(.8, '#d7b8ff44'); g.addColorStop(.94, '#a5ecff77'); g.addColorStop(1, '#fcdaffc0');
    ctx.beginPath(); ctx.moveTo(-size, -size * .6); ctx.lineTo(size * .6, -size); ctx.lineTo(size * .4, size * .7); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = g; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size, -size * .6); ctx.lineTo(size * .4, size * .7); ctx.lineTo(0, -size * .3); ctx.closePath();
    ctx.globalAlpha = alpha * .45; ctx.fill(); ctx.restore();
  }

  function drawPresence(t) {
    if (presence < .01) return;
    ctx.save(); ctx.globalAlpha = presence * .27;
    const scale = Math.min(w / 1500, h / 900);
    ctx.translate(w * (w < 650 ? .59 : .62) + pointer[0] * 7, h * .32 + pointer[1] * 4);
    ctx.scale(scale, scale);
    const profile = new Path2D('M-68-102 C17-126 66-79 62-27 C67-6 84 6 98 16 Q103 23 87 28 L87 39 Q99 46 87 51 Q92 67 72 72 C42 77 41 93 56 117 Q81 144 137 161');
    ctx.strokeStyle = '#e4cfff'; ctx.lineWidth = .9; ctx.shadowColor = '#c1baff'; ctx.shadowBlur = 10; ctx.stroke(profile);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      ribbon(u => {
        const a = u * TAU * 1.12 - Math.PI * .65;
        const rx = w * (.14 + i * .018);
        return [w * .61 + Math.cos(a) * rx + pointer[0] * 10 + bend * 40 * Math.sin(u * Math.PI), h * (.28 + u * .49) + Math.sin(a) * h * .1 + Math.sin(t + i) * 4];
      }, w * .026, i * 1.3, presence * .78);
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(184,218,255,${presence * (.18 - i * .03)})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(w * .61, h * .79 + i * 5, w * (.095 + i * .035), h * (.012 + i * .007), -.03, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function paintScenery() {
    previous.width = scenery.width; previous.height = scenery.height;
    if (scenery.width && scenery.height) previousContext.drawImage(scenery, 0, 0);
    scenery.width = canvas.width; scenery.height = canvas.height;
    ctx = sceneryContext;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(atmosphere, 0, 0, w, h);
    const t = 0, savedPointer = pointer;
    pointer = [0, 0];
    const calm = room === 'blog' || room === 'archive' || room === 'guestbook';
    if (!calm) {
      prism(w * .49 + pointer[0] * 18, -h * .08 + pointer[1] * 8, w * .16, -.2, .65);
      prism(w * 1.06 - pointer[0] * 12, h * .83, w * .1, .7, .42);
    }
    ribbon(u => [w * (-.12 + u * 1.35) + pointer[0] * 9, h * (.88 - .64 * u + (.19 + bend * .035) * Math.sin(u * TAU - .5)) + pointer[1] * 7 + Math.sin(t * .4 + u * 4) * 3], w * (calm ? .024 : .056), .7, calm ? .4 : .95);
    ribbon(u => [w * (1.11 - u * 1.38) - pointer[0] * 12, h * (.11 + .74 * u + .2 * Math.sin(u * TAU + bend * .2)) + pointer[1] * 10], w * .04, 1.9, calm ? .23 : .66);
    if (!calm) ribbon(u => [w * (-.2 + 1.45 * u), h * (.99 - .16 * Math.sin(u * Math.PI))], w * .046, .4, .9);
    drawPresence(t);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (w < 650 ? 11 : 23); i++) {
      const x = ((i * 173.19 + 90) % 997) / 997 * w + pointer[0] * (i % 5), y = ((i * 97.13 + 150) % 899) / 899 * h;
      const size = i % 5 === 0 ? 5 + i % 3 : .5 + (i % 4) * .4;
      ctx.globalAlpha = calm ? .13 : .45;
      ctx.fillStyle = i % 3 ? '#c0e9ff' : '#f6d7ff';
      ctx.beginPath(); ctx.moveTo(x + size, y - size * 1.4); ctx.lineTo(x + size * .6, y + size * .4); ctx.lineTo(x - size, y + size * 1.4); ctx.lineTo(x - size * .6, y - size * .4); ctx.closePath(); ctx.fill();
    }
    ctx.restore(); pointer = savedPointer; ctx = output;
    blend = reduced() || !previous.width ? 1 : 0;
  }

  function paintExperiment() {
    ctx = experimentContext;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if ((room === 'lab' || room === 'works' || snapshot) && rig) {
      const actual = snapshot ? displayedSnapshot : nodes;
      for (let i = 1; i >= 0; i--) ribbon(u => {
        const p = lightPoint(actual, u);
        return [rig.x + p[0] * rig.width, rig.y + p[1] * rig.height + i * 7 * Math.sin(u * Math.PI * 3)];
      }, Math.min(w * .028, 42) * (1 + i * .38), .5 + i * .22, .95);
    }
    ctx = output; rigDirty = false;
  }

  function draw(now) {
    frame = 0;
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 7);
    pointer = pointer.map((v, i) => mix(v, targetPointer[i], k));
    blend = reduced() ? 1 : Math.min(1, blend + dt * 2.5);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = pointer[0] * 9, y = pointer[1] * 7;
    if (blend < 1) ctx.drawImage(previous, -w * .015 + x, -h * .015 + y, w * 1.03, h * 1.03);
    ctx.globalAlpha = blend;
    ctx.drawImage(scenery, -w * .015 + x, -h * .015 + y, w * 1.03, h * 1.03);
    ctx.globalAlpha = 1;
    if (snapshot) {
      const moving = displayedSnapshot.some((p, i) => p.some((v, axis) => Math.abs(v - snapshot[i][axis]) > .0001));
      if (moving) {
        displayedSnapshot = displayedSnapshot.map((p, i) => p.map((v, axis) => mix(v, snapshot[i][axis], reduced() ? 1 : k)));
        rigDirty = true;
      }
    }
    if (rigDirty) paintExperiment();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(experiment, 0, 0, w, h);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 18 * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * .5, p.angle, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (!reduced() && !document.hidden && (now < until || particles.length || blend < 1)) frame = requestAnimationFrame(draw);
  }

  function wake(duration = 1100) {
    if (signal.aborted || document.hidden) return;
    until = performance.now() + duration;
    if (!frame) { last = performance.now(); frame = requestAnimationFrame(draw); }
  }
  function resize() {
    w = innerWidth; h = innerHeight; dpr = Math.min(devicePixelRatio || 1, w < 650 ? 1.5 : 1.75);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    experiment.width = canvas.width; experiment.height = canvas.height; rigDirty = true;
    paintAtmosphere(); paintScenery(); wake(400);
  }
  window.addEventListener('resize', resize, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; particles = []; }
    else wake(200);
  }, { signal });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    particles = []; blend = 1; wake(0);
  }, { signal });
  signal.addEventListener('abort', () => { cancelAnimationFrame(frame); particles = []; }, { once: true });
  resize();
  return {
    scene(value) { room = value; presence = value === 'home' ? 1 : 0; snapshot = null; displayedSnapshot = null; rigDirty = true; paintAtmosphere(); paintScenery(); wake(1500); },
    turn() { bend = bend ? 0 : 1; paintScenery(); wake(1500); },
    pointer(x, y) { if (reduced()) return; targetPointer = [x / w - .5, y / h - .5]; wake(650); },
    shape(value, rect) { nodes = value; rig = rect; rigDirty = true; wake(650); },
    preview(value, rect) { displayedSnapshot ||= nodes.map(p => [...p]); snapshot = value; rig = rect; rigDirty = true; wake(1100); },
    burst(x, y, count = 24) {
      if (reduced() || document.hidden) return;
      const colors = ['#d7fbff', '#a5e8ff', '#d9c4ff', '#ffe6bd'];
      const budget = Math.min(count, 80 - particles.length);
      for (let i = 0; i < budget; i++) {
        const a = i * 2.4, speed = 25 + i % 7 * 12;
        particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: 1 + i % 4, angle: a, color: colors[i % 4], life: .65 + i % 5 * .15 });
      }
      wake(1500);
    },
    get active() { return Boolean(frame); },
  };
}
