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

// Only the authored sketch is drawn; rooms and reading pages have no decorative ribbons.
export function createLightSpace(canvas, { signal }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sketch requires Canvas 2D');
  let room = 'home', nodes = INITIAL_LIGHT, rig = null, preview = null;
  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!rig || (room !== 'lab' && room !== 'archive')) return;
    const shape = room === 'archive' ? preview : nodes;
    if (!shape) return;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const [x, y] = lightPoint(shape, i / 80);
      const px = rig.x + x * rig.width, py = rig.y + y * rig.height;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.strokeStyle = '#c8d7df'; ctx.lineWidth = 2; ctx.stroke();
  }
  window.addEventListener('resize', draw, { signal });
  signal.addEventListener('abort', () => ctx.clearRect(0, 0, canvas.width, canvas.height), { once: true });
  draw();
  return {
    scene(value) { room = value; draw(); },
    shape(value, rect) { nodes = value; rig = rect; draw(); },
    preview(value, rect) { preview = value; rig = rect; draw(); },
    get active() { return false; },
  };
}
