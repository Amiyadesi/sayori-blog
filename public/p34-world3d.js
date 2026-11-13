import {
  LAYERS,
  LAYER_LABELS,
  TARGET_PILLARS,
  CLUE_INFO,
} from './p34-journey.js?v=20261113-library';

const PLAYER_RADIUS = 0.42;
const EYE_HEIGHT = 1.65;

// Architecture and collision use the same dimensions; side rooms are not quest gates.
const ATRIUM_WALLS = [
  ...[-1, 1].flatMap(side => [-8, 1, 10].filter(z => side !== 1 || z !== 10).map(z => ({ x: side * 13.5, z, w: .45, d: 5.4, h: 7.2 }))),
  { x: 13.5, z: 10, w: .45, d: 5.4, h: 2.7 },
  { x: 13.5, z: 10, w: .45, d: 5.4, h: 2.3, y: 4.9 },
  { x: 13.5, z: 7.5, w: .45, d: .4, h: 7.2 },
  { x: 13.5, z: 12.5, w: .45, d: .4, h: 7.2 },
  { x: -24, z: 5.5, w: .45, d: 29, h: 4.8 },
  { x: 24, z: 5.5, w: .45, d: 29, h: 4.8 },
  { x: -18.75, z: -9, w: 10.5, d: .45, h: 4.8 },
  { x: 18.75, z: -9, w: 10.5, d: .45, h: 4.8 },
  { x: 0, z: 20, w: 48, d: .45, h: 3.4 },
  { x: -8.5, z: 12.5, w: 10, d: .45, h: 6.5 },
  { x: 8.5, z: 12.5, w: 10, d: .45, h: 6.5 },
  { x: 4.2, z: 5.7, w: 5.4, d: .45, h: 3.4 },
  { x: 18.2, z: -1, w: .45, d: 10, h: 4.8 },
  { x: -21, z: 6, w: 6, d: .45, h: 4.8 },
  { x: -16.75, z: -2, w: 6.5, d: .45, h: 4.8 },
  { x: -6, z: 15.4, w: .45, d: 3.8, h: 3.4 },
  { x: 7, z: 17.8, w: .45, d: 4, h: 3.4 },
  { x: 0, z: -19.2, w: 27, d: .45, h: 8 },
];

export function getLibraryConfig(posts) {
  const positions = [[-5.6, 5], [5.6, 1], [-5.6, -5], [5.6, -10], [-5.6, -15]];
  return {
    id: 'library', title: '阅览室',
    spawn: { x: 0, y: 0, z: 9, yaw: 0, pitch: 0 },
    bounds: { minX: -10.8, maxX: 10.8, minZ: -19.5, maxZ: 11.5 },
    surfaces: [{ minX: -11.5, maxX: 11.5, minZ: -20, maxZ: 12, yStart: 0, yEnd: 0, axis: 'flat', enabled: true }],
    colliders: [
      ...[-1, 1].flatMap(side => [-14, -4, 6].map(z => ({
        minX: side * 8.4 - .9, maxX: side * 8.4 + .9, minZ: z - 3, maxZ: z + 3, minY: 0, maxY: 6.8, enabled: true,
      }))),
      ...posts.map((post, i) => ({ bookSlug: post.slug, minX: positions[i][0] - .8, maxX: positions[i][0] + .8, minZ: positions[i][1] - .5, maxZ: positions[i][1] + .5, minY: 0, maxY: 1.1, enabled: true })),
      ...[-1, 1].flatMap(side => [-9, 1].map(z => ({ minX: side * 3.2 - .4, maxX: side * 3.2 + .4, minZ: z - .4, maxZ: z + .4, minY: 0, maxY: 8, enabled: true }))),
    ],
    interactables: [
      { id: 'library-exit', label: '书库', prompt: '走入', kind: 'library-exit', x: 0, y: 1.5, z: 11.2, crossing: { z: 10.7, direction: 1, halfWidth: 1.35 } },
      ...posts.map((post, i) => ({ id: `book-${post.slug}`, label: post.title, prompt: 'E · 翻开', kind: 'book', slug: post.slug, x: positions[i][0], y: 1.2, z: positions[i][1] })),
    ],
  };
}

export function getLayerConfig(layer, state = {}) {
  if (layer === 'atrium') {
    const bridgeSolid = Boolean(state.bridgeSolid);
    return {
      id: 'atrium',
      title: LAYER_LABELS.atrium,
      spawn: { x: 0, y: 0, z: 8.8, yaw: 0, pitch: 0 },
      bounds: { minX: -24, maxX: 24, minZ: -18.8, maxZ: 20 },
      walls: ATRIUM_WALLS,
      surfaces: [
        // Main floor
        { id: 'main-floor', minX: -13.5, maxX: 13.5, minZ: -12.5, maxZ: 12.5, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
        { id: 'west-rooms', minX: -24, maxX: -13, minZ: -9, maxZ: 20, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
        { id: 'east-rooms', minX: 13, maxX: 24, minZ: -9, maxZ: 20, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
        { id: 'rear-passage', minX: -24, maxX: 24, minZ: 12, maxZ: 20, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
        { id: 'window-stairs', minX: 20, maxX: 22.6, minZ: 14, maxZ: 18, yStart: 0, yEnd: 2.2, axis: '-z', enabled: true },
        { id: 'window-mezzanine', minX: 18.8, maxX: 23.5, minZ: 8, maxZ: 14, yStart: 2.2, yEnd: 2.2, axis: 'flat', enabled: true },
        // West staircase (Z: -2.0 -> -6.8 rises Y: 0 -> 3.2)
        { id: 'west-stairs', minX: -11.4, maxX: -7.4, minZ: -6.8, maxZ: -1.8, yStart: 0, yEnd: 3.2, axis: '-z', enabled: true },
        // Upper mezzanine balcony (Z: -10.5 -> -6.6 at Y = 3.2)
        { id: 'mezzanine', minX: -11.4, maxX: 7.5, minZ: -10.6, maxZ: -6.6, yStart: 3.2, yEnd: 3.2, axis: 'flat', enabled: true },
        // Dynamic 3D Light Bridge (Z: -10.2 -> -14.2 rises Y: 3.2 -> 3.6)
        { id: 'light-bridge', minX: -2.4, maxX: 2.4, minZ: -14.4, maxZ: -10.0, yStart: 3.2, yEnd: 3.6, axis: '-z', enabled: bridgeSolid },
        // High Observation Platform (Z: -18.2 -> -14.0 at Y = 3.6)
        { id: 'high-platform', minX: -4.6, maxX: 4.6, minZ: -18.2, maxZ: -14.0, yStart: 3.6, yEnd: 3.6, axis: 'flat', enabled: bridgeSolid },
      ],
      colliders: [
        ...ATRIUM_WALLS.map(wall => ({ minX: wall.x - wall.w / 2, maxX: wall.x + wall.w / 2, minZ: wall.z - wall.d / 2, maxZ: wall.z + wall.d / 2, minY: wall.y || 0, maxY: (wall.y || 0) + wall.h, enabled: true })),
        { id: 'window-rail', minX: 18.8, maxX: 23.5, minZ: 7.9, maxZ: 8.1, minY: 2.2, maxY: 3.1, enabled: true },
        { id: 'east-window-seat', minX: 22.1, maxX: 23.3, minZ: -7.3, maxZ: -3.7, minY: 0, maxY: .6, enabled: true },
        { id: 'west-window-seat', minX: -23.45, maxX: -22.35, minZ: 10, maxZ: 14, minY: 0, maxY: .6, enabled: true },
        // Central courtyard pillars
        { id: 'col-nw', minX: -4.6, maxX: -3.4, minZ: -4.6, maxZ: -3.4, minY: 0, maxY: 6, enabled: true },
        { id: 'col-ne', minX: 3.4, maxX: 4.6, minZ: -4.6, maxZ: -3.4, minY: 0, maxY: 6, enabled: true },
        { id: 'col-sw', minX: -4.6, maxX: -3.4, minZ: 3.4, maxZ: 4.6, minY: 0, maxY: 6, enabled: true },
        { id: 'col-se', minX: 3.4, maxX: 4.6, minZ: 3.4, maxZ: 4.6, minY: 0, maxY: 6, enabled: true },
        // West gallery divider wall
        { id: 'west-divider', minX: -7.4, maxX: -6.6, minZ: -6.2, maxZ: -0.5, minY: 0, maxY: 4.5, enabled: true },
        { id: 'fold-desk', minX: -0.7, maxX: 0.7, minZ: 0.6, maxZ: 1.8, minY: 0, maxY: 1.2, enabled: true },
        // East alcove pedestal table
        { id: 'east-table', minX: 8.6, maxX: 10.2, minZ: -2.8, maxZ: 2.8, minY: 0, maxY: 1.5, enabled: true },
        // North chasm blocker when light bridge is not solid (blocks walking north past Z = -10.4)
        { id: 'chasm-guard', minX: -13.5, maxX: 13.5, minZ: -18.5, maxZ: -10.4, minY: 0, maxY: 5.0, enabled: !bridgeSolid },
      ],
      interactables: [
        {
          id: 'viewport-seam',
          label: '接缝',
          prompt: 'E · 查看',
          x: 0, y: 1.6, z: 11.4,
          kind: 'seam',
        },
        {
          id: 'light-sculpture-rig',
          label: '折页台',
          prompt: 'E · 打开',
          x: 0, y: 1.4, z: 1.2,
          kind: 'lab-link',
        },
        {
          id: 'east-prism-lamp',
          label: '纸灯',
          prompt: 'E · 转动',
          x: 8.8, y: 1.4, z: -1.8,
          kind: 'glb-lamp',
        },
        {
          id: 'east-tuning-fork',
          label: '音叉',
          prompt: 'E · 轻敲',
          x: 8.8, y: 1.4, z: 1.8,
          kind: 'glb-fork',
        },
        {
          id: 'east-web-terminal',
          label: '终端',
          prompt: 'E · 打开',
          x: 11.2, y: 1.5, z: 0,
          kind: 'terminal',
        },
        {
          id: 'portal-to-stacks',
          label: '书库',
          prompt: 'E · 穿过',
          x: 0, y: 4.6, z: -9.6, floorY: 3.2,
          kind: 'portal',
          targetLayer: 'stacks',
          crossing: { z: -9.9, direction: -1, halfWidth: 1.3 },
        },
        {
          id: 'high-platform-survey',
          label: '测绘纸',
          prompt: 'E · 阅读',
          x: 0, y: 4.9, z: -16.2, floorY: 3.6,
          kind: 'clue',
          clueId: 'atrium-survey',
        },
      ],
    };
  }

  if (layer === 'stacks') {
    const unlocked = Boolean(state.stacksUnlocked);
    return {
      id: 'stacks',
      title: LAYER_LABELS.stacks,
      spawn: { x: 0, y: 0, z: 8.8, yaw: 0, pitch: 0 },
      bounds: { minX: -11.5, maxX: 11.5, minZ: -13.5, maxZ: 11.5 },
      surfaces: [
        { id: 'stacks-floor', minX: -12.0, maxX: 12.0, minZ: -7.5, maxZ: 12.0, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
        { id: 'north-bridge', minX: -2.5, maxX: 2.5, minZ: -13.8, maxZ: -7.2, yStart: 0, yEnd: 0.6, axis: '-z', enabled: unlocked },
      ],
      colliders: [
        { id: 'sliding-shelf', minX: state.shelfMoved ? -6.8 : -2.8, maxX: state.shelfMoved ? -3.6 : 0.4, minZ: 3.8, maxZ: 4.6, minY: 0, maxY: 4.2, enabled: true },
        { id: 'north-void-guard', minX: -12.0, maxX: 12.0, minZ: -14.0, maxZ: -7.4, minY: 0, maxY: 5.0, enabled: !unlocked },
        { id: 'west-stack-wall', minX: -10.8, maxX: -9.2, minZ: -6.0, maxZ: 6.0, minY: 0, maxY: 8.0, enabled: true },
        { id: 'east-stack-wall', minX: 9.2, maxX: 10.8, minZ: -6.0, maxZ: 6.0, minY: 0, maxY: 8.0, enabled: true },
      ],
      interactables: [
        {
          id: 'portal-back-atrium',
          label: '回廊',
          prompt: 'E · 返回',
          x: 0, y: 1.6, z: 10.8,
          kind: 'portal',
          targetLayer: 'atrium',
          crossing: { z: 10.3, direction: 1, halfWidth: 1.3 },
        },
        {
          id: 'blog-reading-desk',
          label: '摊开的笔记',
          prompt: 'E · 阅读',
          x: -7.2, y: 1.4, z: 0.8,
          kind: 'blog-desk',
        },
        {
          id: 'east-relic-cabinet',
          label: '旧稿',
          prompt: 'E · 翻看',
          x: 7.2, y: 1.5, z: 0.8,
          kind: 'clue',
          clueId: 'retired-relic',
        },
        {
          id: 'blog-projector',
          label: '投影仪',
          prompt: 'E · 投射',
          x: 0, y: 1.3, z: -0.8,
          kind: 'projector',
        },
        {
          id: 'pillar-west',
          label: '西柱',
          prompt: 'E · 转动',
          x: -4.2, y: 1.6, z: -4.2,
          kind: 'pillar',
          pillar: 'west',
        },
        {
          id: 'pillar-center',
          label: '中柱',
          prompt: 'E · 调整',
          x: 0, y: 1.6, z: -5.2,
          kind: 'pillar',
          pillar: 'center',
        },
        {
          id: 'pillar-east',
          label: '东柱',
          prompt: 'E · 调整',
          x: 4.2, y: 1.6, z: -4.2,
          kind: 'pillar',
          pillar: 'east',
        },
        {
          id: 'portal-to-loft',
          label: '阁楼',
          prompt: 'E · 穿过',
          x: 0, y: 2.1, z: -11.6,
          kind: 'portal',
          targetLayer: 'loft',
          crossing: { z: -11.3, direction: -1, halfWidth: 1.3 },
        },
      ],
    };
  }

  // Layer 3: loft
  return {
    id: 'loft',
    title: LAYER_LABELS.loft,
    spawn: { x: 0, y: 0, z: 6.2, yaw: 0, pitch: 0 },
    bounds: { minX: -7.8, maxX: 7.8, minZ: -7.8, maxZ: 7.8 },
    surfaces: [
      { id: 'loft-floor', minX: -8.2, maxX: 8.2, minZ: -8.2, maxZ: 8.2, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
    ],
    colliders: [
      { id: 'workbench-col', minX: -1.6, maxX: 1.6, minZ: -2.2, maxZ: -0.6, minY: 0, maxY: 1.6, enabled: true },
    ],
    interactables: [
      {
        id: 'portal-back-stacks',
          label: '书库',
          prompt: 'E · 返回',
        x: 0, y: 1.6, z: 7.4,
        kind: 'portal',
        targetLayer: 'stacks',
        crossing: { z: 7.0, direction: 1, halfWidth: 1.3 },
      },
      {
        id: 'her-workbench',
          label: '工作台',
          prompt: 'E · 聊聊',
        x: 0, y: 1.4, z: -1.4,
        kind: 'talk-bench',
      },
      {
        id: 'clue-slot-34',
          label: '第 34 页',
          prompt: 'E · 阅读',
        x: -4.4, y: 1.5, z: -2.2,
        kind: 'clue',
        clueId: 'slot-34-log',
      },
      {
        id: 'clue-dual-handwriting',
          label: '批注',
          prompt: 'E · 翻面',
        x: 4.4, y: 1.5, z: -2.2,
        kind: 'clue',
        clueId: 'dual-handwriting',
      },
      {
        id: 'clue-rain-window',
          label: '窗边的记录',
          prompt: 'E · 查看',
        x: 0, y: 1.6, z: -6.8,
        kind: 'clue',
        clueId: 'rain-origin-trace',
      },
      {
        id: 'loft-guestbook-desk',
          label: '留言簿',
          prompt: 'E · 留言',
        x: 4.2, y: 1.3, z: 3.4,
        kind: 'guestbook-link',
      },
    ],
  };
}

export function computeFloorElevation(x, z, currentY, surfaces = []) {
  let bestY = null;
  for (const s of surfaces) {
    if (!s.enabled) continue;
    if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
      let y = s.yStart;
      if (s.axis === '-z') {
        const t = Math.max(0, Math.min(1, (s.maxZ - z) / (s.maxZ - s.minZ || 1)));
        y = s.yStart + t * (s.yEnd - s.yStart);
      } else if (s.axis === '+z') {
        const t = Math.max(0, Math.min(1, (z - s.minZ) / (s.maxZ - s.minZ || 1)));
        y = s.yStart + t * (s.yEnd - s.yStart);
      }
      if (y <= currentY + 1.35) {
        if (bestY === null || y > bestY) bestY = y;
      }
    }
  }
  return bestY ?? 0;
}

function hitsCollider(x, z, y, colliders, radius = PLAYER_RADIUS) {
  for (const c of colliders) {
    if (!c.enabled) continue;
    if (y + EYE_HEIGHT < (c.minY ?? 0) || y > (c.maxY ?? 10)) continue;
    const closestX = Math.max(c.minX, Math.min(x, c.maxX));
    const closestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

export function resolvePlayerMovement(pos, nextX, nextZ, config) {
  const { bounds, colliders, surfaces } = config;
  const clampX = x => Math.max(bounds.minX + PLAYER_RADIUS, Math.min(bounds.maxX - PLAYER_RADIUS, x));
  const clampZ = z => Math.max(bounds.minZ + PLAYER_RADIUS, Math.min(bounds.maxZ - PLAYER_RADIUS, z));

  let x = pos.x;
  let z = pos.z;
  let y = pos.y || 0;

  const onFloor = (x, z) => surfaces.some(s => s.enabled && Math.min(s.yStart, s.yEnd) <= y + 1.35 && x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ);
  const candX = clampX(nextX);
  const candZ = clampZ(nextZ);

  // Try X movement
  const yAtX = computeFloorElevation(candX, z, y, surfaces);
  if (onFloor(candX, z) && !hitsCollider(candX, z, yAtX, colliders)) {
    x = candX;
    y = yAtX;
  }
  // Try Z movement
  const yAtZ = computeFloorElevation(x, candZ, y, surfaces);
  if (onFloor(x, candZ) && !hitsCollider(x, candZ, yAtZ, colliders)) {
    z = candZ;
    y = yAtZ;
  }

  return { x, y, z };
}

export function crossedDoor(before, after, interactables) {
  return interactables.find(door => {
    const threshold = door.crossing;
    if (!threshold || Math.abs(after.x - door.x) > threshold.halfWidth || Math.abs(after.y - (door.floorY || 0)) > .9) return false;
    return (before.z - threshold.z) * threshold.direction < 0 && (after.z - threshold.z) * threshold.direction >= 0;
  });
}

export function findInteractiveTarget(pos, yaw, pitch, interactables = [], maxDist = 3.0) {
  const lookX = -Math.sin(yaw) * Math.cos(pitch);
  const lookY = Math.sin(pitch);
  const lookZ = -Math.cos(yaw) * Math.cos(pitch);
  const eyeY = (pos.y || 0) + EYE_HEIGHT;

  let best = null;
  let bestScore = Infinity;

  for (const item of interactables) {
    if (item.floorY !== undefined && Math.abs((pos.y || 0) - item.floorY) > 0.9) continue;
    const dx = item.x - pos.x;
    const dy = (item.y ?? 1.4) - eyeY;
    const dz = item.z - pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > maxDist) continue;
    const inv = 1 / (dist || 0.001);
    const dot = (dx * lookX + dy * lookY + dz * lookZ) * inv;
    if (item.kind === 'portal' && dot < 0.6) continue;
    // Close objects remain reachable without precision aiming.
    if (dot < 0.42 && dist > 2.1) continue;
    const score = dist * (1.35 - Math.max(0, dot) * 0.65);
    if (score < bestScore) {
      bestScore = score;
      best = { ...item, distance: dist };
    }
  }
  return best;
}

export async function mountWorld3D(container, {
  getState,
  getLightNodes,
  motion,
  onInteract,
  onLayerChange,
  onShelfMoved,
  onOpenRoom,
  onLeaveSite,
  library = null,
  signal,
}) {
  const THREE = await import('./third-party/three/three.module.min.js');
  const { GLTFLoader } = await import('./third-party/three/GLTFLoader.js');
  const css3d = library ? await import('./third-party/three/CSS3DRenderer.js') : null;
  if (signal?.aborted) return null;

  const root = document.createElement('div');
  root.className = 'world3d-stage';
  root.innerHTML = `
    <div class="world3d-viewport" data-viewport tabindex="0" role="application" aria-label="三维页背探索空间，使用 WASD 移动，鼠标或方向键转动视角，E 或点击交互"></div>
    <div class="world3d-reticle" data-reticle aria-hidden="true"><span></span></div>
    <header class="world3d-hud-top">
      <button type="button" data-inspector-btn class="world3d-chip" aria-label="暂停" title="暂停 · Esc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg></button>
    </header>
    <p class="world3d-help" data-help>WASD 移动 · 拖动环视 · E 互动 · Esc 暂停</p>
    <div class="world3d-prompt" data-prompt hidden aria-live="polite">
      <span class="world3d-prompt-title" data-prompt-title></span>
      <button type="button" class="world3d-prompt-action" data-prompt-btn></button>
    </div>
    <div class="world3d-touch-controls" data-touch-controls aria-label="触屏移动与视角控制">
      <div class="world3d-touch-pad" data-touch-move role="group" aria-label="左下虚拟摇杆：拖动移动">
        <button type="button" data-step="forward" aria-label="前进">▲</button>
        <div class="world3d-touch-row">
          <button type="button" data-step="left" aria-label="左移">◀</button>
          <button type="button" data-step="right" aria-label="右移">▶</button>
        </div>
        <button type="button" data-step="back" aria-label="后退">▼</button>
      </div>
      <div class="world3d-touch-pad world3d-touch-look" data-touch-look role="group" aria-label="右下视角控制">
        <div class="world3d-touch-row">
          <button type="button" data-turn="left" aria-label="向左看">↶</button>
          <button type="button" data-turn="right" aria-label="向右看">↷</button>
        </div>
        <button type="button" class="world3d-touch-interact" data-touch-interact>触碰</button>
      </div>
    </div>
    <aside class="world3d-modal" data-modal hidden role="dialog" aria-modal="true" aria-labelledby="world3d-modal-title">
      <div class="world3d-modal-card">
        <header class="world3d-modal-header">
          <h2 id="world3d-modal-title" data-modal-title></h2>
          <button type="button" data-modal-close aria-label="关闭窗口">×</button>
        </header>
        <div class="world3d-modal-body" data-modal-body></div>
      </div>
    </aside>
  `;
  container.replaceChildren(root);

  const viewport = root.querySelector('[data-viewport]');
  const reticle = root.querySelector('[data-reticle]');
  const promptBox = root.querySelector('[data-prompt]');
  const promptTitle = root.querySelector('[data-prompt-title]');
  const promptBtn = root.querySelector('[data-prompt-btn]');
  const inspectorBtn = root.querySelector('[data-inspector-btn]');
  const help = root.querySelector('[data-help]');
  const modal = root.querySelector('[data-modal]');
  const modalTitle = root.querySelector('[data-modal-title]');
  const modalBody = root.querySelector('[data-modal-body]');
  const modalClose = root.querySelector('[data-modal-close]');

  let renderer = null;
  let webglAvailable = true;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    viewport.append(renderer.domElement);
  } catch (err) {
    webglAvailable = false;
    console.error('3D rendering unavailable', err);
    const fallback = document.createElement('div');
    fallback.className = 'world3d-webgl-fallback';
    fallback.textContent = '无法显示 3D。请开启硬件加速或更换浏览器；也可从「暂停」返回网页。';
    viewport.append(fallback);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 90);
  camera.rotation.order = 'YXZ';
  const pages = new THREE.Scene();
  const pageRenderer = css3d ? new css3d.CSS3DRenderer() : null;
  if (pageRenderer) {
    pageRenderer.domElement.className = 'world3d-pages';
    root.append(pageRenderer.domElement);
  }
  let reading = null, readingObject = null, beforeReading = null;
  let typography = null, typographyMount = null, conversation = null;
  const shell = root.closest('#p34-space');

  async function setDialogue(text, buttons = []) {
    conversation = text ? { text, buttons } : null;
    if (!conversation) {
      typography?.show(null, [], viewport.clientWidth, viewport.clientHeight);
      delete shell.dataset.depthDialogue;
      return;
    }
    if (!renderer) return;
    const request = conversation;
    keys.clear(); draggingLook = false;
    if (document.pointerLockElement === viewport) document.exitPointerLock?.();
    try {
      typographyMount ||= import('./p34-typography.js?v=20261113-library').then(m => m.createSpatialDialogue({ signal, reduced: motion.reduced }));
      typography = await typographyMount;
      if (disposed) { typography.dispose(); return; }
      if (conversation !== request) return;
      typography.show(conversation.text, conversation.buttons, viewport.clientWidth, viewport.clientHeight);
      shell.dataset.depthDialogue = 'true';
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Spatial dialogue failed to load', error);
      help.hidden = false; help.dataset.error = 'true'; help.textContent = '立体文字未载入，可继续使用文字选项';
    }
  }

  function worldConfig() {
    if (!library) return getLayerConfig(currentLayerId, state);
    const room = getLibraryConfig(library.posts);
    room.interactables = room.interactables.filter(i => i.kind !== 'book' || library.canRead(i.slug));
    room.colliders = room.colliders.filter(i => !i.bookSlug || library.canRead(i.bookSlug));
    return room;
  }

  const gltfLoader = new GLTFLoader();
  const loadedModels = new Map();
  async function loadGLB(url) {
    if (loadedModels.has(url)) return loadedModels.get(url).clone(true);
    try {
      const gltf = await new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
      loadedModels.set(url, gltf.scene);
      return gltf.scene.clone(true);
    } catch (err) {
      console.warn('GLB fallback used for', url, err);
      const fallbackGroup = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color: 0x7eeeff, emissive: 0x1c4e6c, roughness: 0.25 })
      );
      mesh.position.y = 0.45;
      fallbackGroup.add(mesh);
      return fallbackGroup;
    }
  }

  let state = getState();
  let currentLayerId = library ? 'library' : LAYERS.includes(state.currentLayer) ? state.currentLayer : 'atrium';
  let config = worldConfig();
  let player = { ...config.spawn };
  let bobPhase = 0;
  let stepDistance = 0;
  let lampColorIdx = 0;
  const LAMP_COLORS = [0x6cecff, 0xc39bff, 0xf6c979];

  const keys = new Set();
  let pointerLocked = false;
  let draggingLook = false;
  let lastPointer = { x: 0, y: 0 };
  let activeTarget = null;
  let animatedObjects = [];
  let dynamicNorthBridgeGroup = null;
  let dynamicSlidingShelf = null;
  let lampLightRef = null;
  let rafId = 0;
  let active = true;
  let disposed = false;
  let lastTime = performance.now();
  let buildId = 0;

  function updateSize() {
    const rect = viewport.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(w, h, false);
    pageRenderer?.setSize(w, h);
    typography?.resize(w, h);
    if (reading) frameReading();
  }

  function frameReading() {
    // Keep real DOM type readable on a phone; the room remains visible around the page.
    const width = Math.min(720, Math.max(340, viewport.clientWidth * .84));
    const height = Math.min(820, Math.max(420, viewport.clientHeight * .8));
    const element = readingObject.element;
    element.style.width = `${width}px`; element.style.height = `${height}px`;
    const distance = Math.max(height, width / camera.aspect) * .0038 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / .86;
    camera.position.set(readingObject.position.x, readingObject.position.y, readingObject.position.z + distance);
    camera.rotation.set(0, 0, 0);
    pageRenderer.render(pages, camera);
    renderer?.render(scene, camera);
  }

  function readBook(post, element) {
    keys.clear(); draggingLook = false;
    if (readingObject) pages.remove(readingObject);
    readingObject = null;
    reading = post;
    root.dataset.reading = String(Boolean(post));
    if (!post) {
      if (beforeReading) player = beforeReading;
      beforeReading = null;
      syncCamera(); updateTargetPrompt();
      viewport.focus({ preventScroll: true });
      return;
    }
    beforeReading ||= { ...player };
    modal.hidden = true;
    if (document.pointerLockElement === viewport) document.exitPointerLock?.();
    const target = config.interactables.find(i => i.slug === post.slug);
    readingObject = new css3d.CSS3DObject(element);
    readingObject.position.set(target.x, 2.35, target.z);
    readingObject.rotation.set(-.025, -.06, 0);
    readingObject.scale.setScalar(.0038);
    pages.add(readingObject);
    frameReading();
    element.querySelector('[data-index]').focus({ preventScroll: true });
  }

  function clearScene() {
    buildId++;
    const freed = new Set();
    scene.traverse(obj => {
      obj.shadow?.dispose();
      const materials = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      for (const resource of [obj.geometry, ...materials.flatMap(m => [m.map, m])]) {
        if (resource && !freed.has(resource)) { freed.add(resource); resource.dispose(); }
      }
    });
    animatedObjects = [];
    dynamicNorthBridgeGroup = null;
    dynamicSlidingShelf = null;
    lampLightRef = null;
    while (scene.children.length > 0) {
      const obj = scene.children[0];
      scene.remove(obj);
    }
  }

  function populateAtrium() {
    const version = buildId;
    scene.background = new THREE.Color(0x595c56);
    scene.fog = new THREE.Fog(0x595c56, 24, 65);

    const hemi = new THREE.HemisphereLight(0xe0e3d8, 0x6d7268, 1.25);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xf1ecda, 1.4);
    dir.position.set(18, 12, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    Object.assign(dir.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: .5, far: 65 });
    dir.shadow.normalBias = .04;
    dir.shadow.bias = -.0001;
    dir.shadow.autoUpdate = false; dir.shadow.needsUpdate = true;
    scene.add(dir);

    const centerLight = new THREE.PointLight(0xe6dfc9, 1.3, 22);
    centerLight.position.set(0, 4.2, 0);
    scene.add(centerLight);

    const westLight = new THREE.PointLight(0xf5c476, 1.8, 16);
    westLight.position.set(-9.2, 3.2, 0);
    scene.add(westLight);

    const eastLight = new THREE.PointLight(LAMP_COLORS[lampColorIdx], 2.0, 16);
    eastLight.position.set(9.2, 3.2, -1.5);
    scene.add(eastLight);
    lampLightRef = eastLight;

    const grain = new Uint8Array(128 * 128 * 4);
    for (let i = 0; i < grain.length; i += 4) {
      const shade = 235 + Math.floor(Math.random() * 20);
      grain[i] = grain[i + 1] = grain[i + 2] = shade; grain[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(grain, 128, 128);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(16, 16);
    texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x999c91, map: texture, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 26), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);


    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd0cec0, roughness: 1 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xc5c7bc, roughness: 1, emissive: 0x53564c, emissiveIntensity: .2 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x7c7262, roughness: 1 });
    const box = (w, h, d, x, y, z, material = wallMat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
    };
    for (const wall of config.walls) box(wall.w, wall.h, wall.d, wall.x, (wall.y || 0) + wall.h / 2, wall.z);
    box(.8, 4.5, 5.7, -7, 2.25, -3.35);
    for (const side of [-1, 1]) {
      box(10.5, .2, 29, side * 18.75, -.1, 5.5, floorMat);
      box(10.5, .2, 29, side * 18.75, 4.9, 5.5, ceilingMat);
    }
    box(27, .2, 7.5, 0, -.1, 16.25, floorMat);
    box(48, .2, 7.5, 0, 3.5, 16.25, ceilingMat);
    box(27, .25, 6.5, 0, 3.5, 9, ceilingMat);
    box(27, .25, 18, 0, 7.5, -3.5, ceilingMat);

    // Quiet rooms have views and different scales, not more switches to collect.
    const daylight = new THREE.MeshBasicMaterial({ color: 0xe2e5d9 });
    const window = box(.05, 2.8, 3.5, 23.74, 2.5, -5.5, daylight); window.castShadow = false;
    for (const z of [-6.65, -5.5, -4.35]) box(.12, 2.8, .045, 23.65, 2.5, z, timber);
    box(1.15, .16, 3.6, 22.7, .5, -5.5, timber);
    box(.15, .5, 3.4, 22.7, .25, -5.5, timber);
    box(.05, .9, 5.8, -23.74, 2.5, 12, daylight).castShadow = false;
    box(1.1, .18, 4, -22.9, .5, 12, timber);
    box(.16, .5, 3.8, -22.9, .25, 12, timber);
    box(4.7, .18, 6, 21.15, 2.11, 11, floorMat);
    box(4.7, .12, .12, 21.15, 3.05, 8, timber);
    for (const x of [18.8, 20.35, 21.9, 23.5]) box(.05, .85, .05, x, 2.63, 8, timber);
    for (let i = 0; i < 10; i++) box(2.6, .22, .4, 21.3, .11 + i * .22, 17.8 - i * .4, floorMat);
    for (const z of [8.2, 10, 11.8]) box(.12, 2.2, .06, 13.5, 3.8, z, timber);

    const seamMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.2), new THREE.MeshBasicMaterial({ color: 0x66675d, side: THREE.DoubleSide }));
    seamMesh.position.set(0, 1.6, 12.1);
    scene.add(seamMesh);

    // Four central chamfered monolith columns
    const colGeom = new THREE.BoxGeometry(1.1, 6.8, 1.1);
    const colMat = wallMat;
    for (const [cx, cz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const col = new THREE.Mesh(colGeom, colMat);
      col.position.set(cx, 3.4, cz);
      scene.add(col);
    }

    // The west stairs are ordinary architecture, not an invisible sightline lock.
    const westStairs = new THREE.Group();
    const stepCount = 10;
    for (let i = 0; i < stepCount; i++) {
      const t = i / (stepCount - 1);
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.24, 0.48),
        new THREE.MeshStandardMaterial({
          color: 0xaaa99a,
          roughness: 1,
        })
      );
      step.position.set(-9.4, 0.2 + t * 3.0, -2.0 - t * 4.6);
      westStairs.add(step);
    }
    scene.add(westStairs);

    // Upper Mezzanine Balcony (Y = 3.2m, Z = -8.6)
    const mezzDeck = new THREE.Mesh(
      new THREE.BoxGeometry(19.0, 0.3, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x888a7d, roughness: 1 })
    );
    mezzDeck.position.set(-2.0, 3.05, -8.6);
    scene.add(mezzDeck);

    // Portal on Mezzanine to Layer 2 (Stacks)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x929ca2, roughness: 0.95 });
    for (const x of [-1.5, 1.5]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.35), doorMat);
      jamb.position.set(x, 4.9, -9.8); scene.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.35), doorMat);
    lintel.position.set(0, 6.5, -9.8); scene.add(lintel);

    // North High Observation Platform (Y = 3.6m, Z = -16.2)
    const highDeck = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.35, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x888a7d, roughness: 1 })
    );
    highDeck.position.set(0, 3.42, -16.1);
    const surveyMonolith = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xb6ac8e, roughness: 1 })
    );
    surveyMonolith.position.set(0, 4.35, -16.2);
    scene.add(highDeck, surveyMonolith);

    const foldTable = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0x74818a, roughness: 1 }));
    foldTable.position.set(0, 0.45, 1.2);
    const foldedPaper = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.7), new THREE.MeshStandardMaterial({ color: 0xd4d2c6, roughness: 1 }));
    foldedPaper.position.set(0, 0.96, 1.2);
    foldedPaper.rotation.z = 0.15;
    scene.add(foldTable, foldedPaper);

    // Saved sketch produces a usable bridge, not a decorative ribbon.
    if (state.bridgeSolid) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 4.4), new THREE.MeshStandardMaterial({ color: 0xb9c8d0, roughness: 0.8 }));
      bridge.position.set(0, 3.34, -12.2);
      bridge.rotation.x = Math.atan2(0.4, 4.4);
      scene.add(bridge);
    }

    // East Wing: Pedestals + GLB models + Backstage Webpage Terminal
    const pedGeom = new THREE.CylinderGeometry(0.55, 0.65, 1.0, 16);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0xcfe4ff, roughness: 0.35 });
    const ped1 = new THREE.Mesh(pedGeom, pedMat);
    ped1.position.set(8.8, 0.5, -1.8);
    const ped2 = new THREE.Mesh(pedGeom, pedMat);
    ped2.position.set(8.8, 0.5, 1.8);
    scene.add(ped1, ped2);

    void loadGLB('/assets/p34/models/paper-prism-lamp.glb').then(model => {
      if (disposed || version !== buildId || currentLayerId !== 'atrium') return;
      model.position.set(8.8, 1.05, -1.8);
      scene.add(model);
      animatedObjects.push(dt => { model.rotation.y += dt * 0.85; });
    });

    void loadGLB('/assets/p34/models/spatial-tuning-fork.glb').then(model => {
      if (disposed || version !== buildId || currentLayerId !== 'atrium') return;
      model.position.set(8.8, 1.05, 1.8);
      scene.add(model);
      animatedObjects.push(dt => { model.rotation.y -= dt * 0.6; });
    });

    const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.7, 2.2), new THREE.MeshStandardMaterial({ color: 0x28323b, roughness: 0.8 }));
    terminal.position.set(11.4, 1.1, 0);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), new THREE.MeshBasicMaterial({ color: 0x9eabb2 }));
    screen.rotation.y = -Math.PI / 2;
    screen.position.set(11.2, 1.5, 0);
    scene.add(terminal, screen);
    scene.traverse(object => {
      if (object.isMesh) { object.receiveShadow = object.material.isMeshStandardMaterial && object.material !== ceilingMat; object.castShadow = object.material.isMeshStandardMaterial && !object.material.transparent && object.material !== ceilingMat; }
    });
  }

  function populateStacks() {
    scene.background = new THREE.Color(0x424a53);
    scene.fog = new THREE.Fog(0x424a53, 18, 60);

    const hemi = new THREE.HemisphereLight(0xd5d8d4, 0x55565c, 1.5);
    scene.add(hemi);

    const amberLeft = new THREE.PointLight(0xf4be68, 2.4, 18);
    amberLeft.position.set(-7.0, 3.5, 1.0);
    const amberRight = new THREE.PointLight(0x88d4ff, 2.0, 18);
    amberRight.position.set(7.0, 3.5, 1.0);
    const projLight = new THREE.PointLight(state.diagram ? 0x6ef7d4 : 0x6e8cff, 2.5, 22);
    projLight.position.set(0, 4.0, -3.5);
    scene.add(amberLeft, amberRight, projLight);

    // Catwalk floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.3, 19.5),
      new THREE.MeshStandardMaterial({ color: 0x505359, roughness: 0.95 })
    );
    floor.position.set(0, -0.15, 2.2);
    scene.add(floor);


    // Towering Archive Monolith Bookshelves (left & right abyssal walls)
    const stackMat = new THREE.MeshStandardMaterial({ color: 0x666c70, roughness: 0.95 });
    const spineMat = new THREE.MeshStandardMaterial({ color: 0xaaa99f, roughness: 0.95 });
    for (let i = 0; i < 6; i++) {
      const z = -6.0 + i * 2.8;
      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 14.0, 1.8), stackMat);
        tower.position.set(side * 10.0, 6.0, z);
        const spine = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.35, 1.5), spineMat);
        spine.position.set(side * 10.0, 2.2 + (i % 3) * 1.4, z);
        scene.add(tower, spine);
        for (let row = 0; row < 5; row++) {
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.8), stackMat);
          shelf.position.set(side * 9.4, 1.0 + row * 1.1, z);
          scene.add(shelf);
        }
      }
    }

    // Girl's interactive sliding shelf
    dynamicSlidingShelf = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 4.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x777b7e, roughness: 0.95 })
    );
    dynamicSlidingShelf.position.set(state.shelfMoved ? -5.2 : -1.2, 2.1, 4.2);
    scene.add(dynamicSlidingShelf);
    if (!state.shelfMoved) {
      let elapsed = 0;
      animatedObjects.push(dt => {
        elapsed += dt;
        dynamicSlidingShelf.position.x = -1.2 - 4 * Math.min(1, elapsed / 1.6);
        if (elapsed >= 1.6 && !state.shelfMoved) {
          onShelfMoved?.();
          state = getState();
          config = getLayerConfig(currentLayerId, state);
        }
      });
    }

    // West Reading Desk (Blog connection)
    const paper = new THREE.MeshStandardMaterial({ color: 0xc3bbaa, roughness: 1, side: THREE.DoubleSide });
    for (const x of [-7.2, 7.2]) {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.3), new THREE.MeshStandardMaterial({ color: 0x514c47, roughness: 0.9 }));
      desk.position.set(x, 1.1, 0.8);
      const note = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), paper);
      note.rotation.x = -Math.PI / 2;
      note.position.set(x, 1.18, 0.8);
      scene.add(desk, note);
    }

    const projector = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), new THREE.MeshStandardMaterial({ color: 0x8a8d88, roughness: 0.9 }));
    projector.position.set(0, 0.8, -0.8);
    scene.add(projector);

    // Three Spatial Index Pillars
    const p = state.pillars || { west: 'void', center: 'ground', east: 'noise' };
    const pillarSpecs = [
      { key: 'west', x: -4.2, z: -4.2, match: p.west === TARGET_PILLARS.west },
      { key: 'center', x: 0, z: -5.2, match: p.center === TARGET_PILLARS.center },
      { key: 'east', x: 4.2, z: -4.2, match: p.east === TARGET_PILLARS.east },
    ];
    for (const spec of pillarSpecs) {
      const group = new THREE.Group();
      group.position.set(spec.x, 0, spec.z);
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, 2.8, 8),
        new THREE.MeshStandardMaterial({
          color: spec.match ? 0x7ef7d4 : 0x8fb8ff,
          emissive: spec.match ? 0x1e6b56 : 0x1a2c54,
          roughness: 0.25,
        })
      );
      column.position.y = 1.4;
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.8, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xf4be68, emissive: 0x694712 })
      );
      fin.position.y = 2.6;
      group.add(column, fin);
      scene.add(group);
    }

    // North Bridge & Gate to Layer 3 (Loft)
    dynamicNorthBridgeGroup = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.26, 6.2),
      new THREE.MeshStandardMaterial({
        color: state.stacksUnlocked ? 0x8ef7d8 : 0x456296,
        emissive: state.stacksUnlocked ? 0x1f6b58 : 0x0e1a33,
        wireframe: !state.stacksUnlocked,
        transparent: true,
        opacity: state.stacksUnlocked ? 0.95 : 0.42,
      })
    );
    dynamicNorthBridgeGroup.position.set(0, 0.1, -10.2);
    scene.add(dynamicNorthBridgeGroup);

    const doorStone = new THREE.MeshStandardMaterial({ color: 0x9caaa5, roughness: 1 });
    for (const z of [-12.2, 10.8]) {
      for (const x of [-1.7, 1.7]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(.3, 3.8, .4), doorStone);
        jamb.position.set(x, 1.9, z); scene.add(jamb);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.7, .3, .4), doorStone);
      lintel.position.set(0, 3.8, z); scene.add(lintel);
    }
  }

  function populateLibrary() {
    scene.background = new THREE.Color(0x777f7c);
    scene.fog = new THREE.Fog(0x777f7c, 20, 55);
    scene.add(new THREE.HemisphereLight(0xe4e7df, 0x575b59, 2.1));
    const daylight = new THREE.DirectionalLight(0xe4e8e0, 1.1);
    daylight.position.set(9, 10, -8); scene.add(daylight);
    const plaster = new THREE.MeshStandardMaterial({ color: 0xa5aaa5, roughness: 1 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x565e58, roughness: 1 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xc6c3ae, roughness: 1 });
    const box = (w, h, d, x, y, z, mat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z); scene.add(mesh); return mesh;
    };
    box(23, .25, 32, 0, -.125, -4, new THREE.MeshStandardMaterial({ color: 0x777e77, roughness: 1 }));
    box(23, .25, 32, 0, 8, -4, plaster);
    box(23, 8, .4, 0, 4, -20, plaster);
    for (const side of [-1, 1]) {
      box(.4, 8, 32, side * 11.5, 4, -4, plaster);
      box(9.8, 8, .4, side * 6.6, 4, 12, plaster);
      for (const z of [-14, -4, 6]) {
        box(1.8, .12, 6, side * 8.4, .1, z, timber);
        box(.14, 6.8, 6, side * 8.4, 3.4, z, timber);
        for (const end of [-3, 3]) box(1.8, 6.8, .12, side * 8.4, 3.4, z + end, timber);
        for (let row = 1; row <= 7; row++) {
          box(1.8, .09, 6, side * 8.4, row * .85, z, timber);
          for (let group = 0; group < 4; group++) {
            box(.6, .48 + (group % 2) * .15, .9, side * 8.4 - side * .35, row * .85 + .3, z - 2.2 + group * 1.45, paper);
          }
        }
      }
      for (const z of [-9, 1]) {
        box(.8, 8, .8, side * 3.2, 4, z, plaster);
        box(6.6, .45, .8, side * 6.5, 7.6, z, plaster);
      }
    }
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xbfcfc9 });
    box(.05, 3.2, 6, 11.24, 3.8, -9, windowMat);
    box(3, 4.6, .08, 0, 2.3, 11.8, new THREE.MeshBasicMaterial({ color: 0x454f50 }));
    for (const target of config.interactables.filter(i => i.kind === 'book')) {
      box(1.6, .12, 1, target.x, 1.02, target.z, timber);
      for (const dx of [-.62, .62]) box(.1, 1, .8, target.x + dx, .5, target.z, timber);
      const cover = box(.65, .07, .85, target.x, 1.14, target.z, paper);
      cover.rotation.y = -.15;
    }
  }

  function populateLoft() {
    const version = buildId;
    scene.background = new THREE.Color(0x68615a);
    scene.fog = new THREE.Fog(0x68615a, 12, 42);

    const hemi = new THREE.HemisphereLight(0xe2d5c2, 0x696269, 1.45);
    scene.add(hemi);

    const warmLamp = new THREE.PointLight(0xf7c679, 2.6, 18);
    warmLamp.position.set(0, 3.4, -1.2);
    const windowLight = new THREE.PointLight(0x72dcff, 1.9, 16);
    windowLight.position.set(0, 3.0, -6.8);
    scene.add(warmLamp, windowLight);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x5e5752, roughness: 0.95 })
    );
    floor.position.set(0, -0.15, 0);
    scene.add(floor);

    // Her Central Workbench + Miniature 3D World Hologram
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.95, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x867666, roughness: 0.95 })
    );
    bench.position.set(0, 0.48, -1.4);
    scene.add(bench);
    const plaster = new THREE.MeshStandardMaterial({ color: 0xaaa292, roughness: 1 });
    for (const x of [-8, 8]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.8, 16), plaster);
      wall.position.set(x, 2.9, 0); scene.add(wall);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(16, 5.8, 0.3), plaster);
    back.position.set(0, 2.9, -8); scene.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 16), plaster);
    roof.position.set(0, 5.8, 0); scene.add(roof);
    const letterDesk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x8a7b6d, roughness: 1 }));
    letterDesk.position.set(4.2, 0.45, 3.4); scene.add(letterDesk);

    void loadGLB('/assets/p34/models/paper-prism-lamp.glb').then(model => {
      if (disposed || version !== buildId || currentLayerId !== 'loft') return;
      model.position.set(0.95, 0.98, -1.4);
      model.scale.setScalar(0.75);
      scene.add(model);
    });

    const paperMat = new THREE.MeshStandardMaterial({ color: 0xc6bfae, roughness: 1 });
    for (const x of [-4.4, 4.4]) {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 0.06), paperMat);
      sheet.position.set(x, 1.5, -2.2);
      sheet.rotation.y = x < 0 ? 0.3 : -0.3;
      scene.add(sheet);
    }
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.5, 0.18), new THREE.MeshStandardMaterial({ color: 0x49464c }));
    windowFrame.position.set(0, 2.2, -7.2);
    const night = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 3.1), new THREE.MeshBasicMaterial({ color: 0x627383 }));
    night.position.set(0, 2.2, -7.09);
    scene.add(windowFrame, night);
    for (const x of [-1.7, 1.7]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(.3, 4.0, .4), plaster);
      jamb.position.set(x, 2, 7.7); scene.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.7, .3, .4), plaster);
    lintel.position.set(0, 4, 7.7); scene.add(lintel);
  }

  function rebuildLayerScene() {
    clearScene();
    state = getState();
    config = worldConfig();
    if (library) populateLibrary();
    else if (currentLayerId === 'atrium') populateAtrium();
    else if (currentLayerId === 'stacks') populateStacks();
    else populateLoft();
    if (reading) frameReading();
    else syncCamera();
    updateTargetPrompt();
  }

  function syncCamera() {
    const bob =
      !motion?.reduced?.() && (keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD'))
        ? Math.sin(bobPhase) * 0.045
        : 0;
    camera.position.set(player.x, (player.y || 0) + EYE_HEIGHT + bob, player.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }

  function updateTargetPrompt() {
    if (reading) { promptBox.hidden = true; activeTarget = null; return; }
    activeTarget = findInteractiveTarget(player, player.yaw, player.pitch, config.interactables);
    reticle.dataset.active = String(Boolean(activeTarget));
    if (activeTarget) {
      promptBox.hidden = false;
      promptTitle.textContent = activeTarget.label;
      promptBtn.textContent = activeTarget.prompt;
      promptBtn.hidden = Boolean(activeTarget.crossing);
    } else {
      promptBox.hidden = true;
    }
  }

  function openInspectorModal(title, renderContent) {
    keys.clear(); draggingLook = false;
    modal.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
    modalTitle.textContent = title;
    modalBody.replaceChildren();
    renderContent(modalBody);
    modal.hidden = false;
    modalClose.focus({ preventScroll: true });
  }

  function closeModal() {
    if (modal.hidden) return false;
    modal.hidden = true;
    viewport.focus({ preventScroll: true });
    return true;
  }

  function openSpatialOverviewModal() {
    state = getState();
    openInspectorModal('暂停', body => {
      const controls = document.createElement('p');
      controls.textContent = 'WASD 移动 · 拖动或鼠标锁定环视 · E 互动';
      body.append(controls);
      const links = document.createElement('div');
      links.className = 'world3d-room-links';
      const button = (text, action) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = text;
        b.addEventListener('click', () => { closeModal(); action(); });
        links.append(b);
      };
      button('继续', () => viewport.focus({ preventScroll: true }));
      button(motion.sound ? '关闭声音' : '开启声音', () => motion.setSound(!motion.sound));
      if (webglAvailable && !matchMedia('(pointer: coarse)').matches) button('锁定鼠标', requestLook);
      for (const l of library ? [] : state.layers) {
        if (l !== currentLayerId) button(LAYER_LABELS[l].replace(/^第.层 · /, ''), () => switchLayer(l));
      }
      for (const [id, name] of library ? [['home', '回到书库']] : [['archive', '档案']]) {
        button(name, () => onOpenRoom?.(id));
      }
      button('返回网页', () => onLeaveSite?.());
      body.append(links);
    });
  }

  function triggerInteraction(target = activeTarget) {
    if (!target) return false;
    motion?.tone?.(2, true);
    state = getState();

    if (target.kind === 'book') { library.onRead(target.slug); return true; }
    if (target.kind === 'library-exit') { onOpenRoom('home'); return true; }

    if (target.kind === 'seam') {
      onLeaveSite?.();
      return true;
    }

    if (target.kind === 'lab-link') {
      onInteract?.('lab-link', target);
      onOpenRoom?.('lab');
      return true;
    }

    if (target.kind === 'glb-lamp') {
      lampColorIdx = (lampColorIdx + 1) % LAMP_COLORS.length;
      if (lampLightRef) lampLightRef.color.setHex(LAMP_COLORS[lampColorIdx]);
      onInteract?.('glb-lamp', target);
      return true;
    }

    if (target.kind === 'glb-fork') {
      motion?.tone?.(5, true);
      onInteract?.('glb-fork', target);
      return true;
    }

    if (target.kind === 'terminal') {
      onInteract?.('terminal', target);
      openSpatialOverviewModal('sayori.org // BACKSTAGE SHELL 终端');
      return true;
    }

    if (target.kind === 'blog-desk') {
      onOpenRoom?.('blog');
      return true;
    }

    if (target.kind === 'projector') {
      if (state.diagram) {
        onInteract?.('sync-pillars', target);
        state = getState();
        config = getLayerConfig(currentLayerId, state);
        rebuildLayerScene();
      } else {
        onInteract?.('projector-hint', target);
      }
      return true;
    }

    if (target.kind === 'pillar') {
      onInteract?.('rotate-pillar', { pillar: target.pillar });
      state = getState();
      config = getLayerConfig(currentLayerId, state);
      rebuildLayerScene();
      return true;
    }

    if (target.kind === 'portal') {
      const dest = target.targetLayer;
      if (dest === 'loft' && !state.stacksUnlocked && !state.layers.includes('loft')) {
        onInteract?.('portal-locked-loft', target);
        return false;
      }
      switchLayer(dest);
      return true;
    }

    if (target.kind === 'clue') {
      const info = CLUE_INFO[target.clueId];
      onInteract?.('clue', target.clueId);
      state = getState();
      if (info) {
        openInspectorModal(info.title, body => {
          body.innerHTML = `
            <p>${info.summary}</p>

            <div class="world3d-room-links">
              <button type="button" data-keep-exploring>放回</button>
              <button type="button" data-view-archive>档案</button>
            </div>
          `;
          body.querySelector('[data-keep-exploring]').addEventListener('click', closeModal);
          body.querySelector('[data-view-archive]').addEventListener('click', () => {
            closeModal();
            onOpenRoom?.('archive');
          });
        });
      }
      return true;
    }

    if (target.kind === 'talk-bench') {
      onInteract?.('talk-bench', target);
      return true;
    }

    if (target.kind === 'guestbook-link') {
      onOpenRoom?.('guestbook');
      return true;
    }

    return false;
  }

  function switchLayer(nextLayer, { push = true } = {}) {
    if (!LAYERS.includes(nextLayer)) return false;
    state = getState();
    if (nextLayer === 'loft' && !state.stacksUnlocked && !state.layers.includes('loft')) {
      onInteract?.('portal-locked-loft');
      return false;
    }
    currentLayerId = nextLayer;
    onLayerChange?.(nextLayer, { push });
    state = getState();
    config = getLayerConfig(currentLayerId, state);
    player = { ...config.spawn };
    rebuildLayerScene();
    return true;
  }

  function stepMovement(dt) {
    if (keys.size) help.hidden = true;
    const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const turn = (keys.has('ArrowLeft') || keys.has('KeyQ') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('KeyR') ? 1 : 0);

    if (turn !== 0) {
      player.yaw += turn * dt * 1.9;
    }

    if (forward !== 0 || strafe !== 0) {
      const len = Math.hypot(forward, strafe) || 1;
      const nf = forward / len;
      const ns = strafe / len;
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6.8 : 4.6;
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      const dx = (-sin * nf + cos * ns) * speed * dt;
      const dz = (-cos * nf - sin * ns) * speed * dt;
      const before = { ...player };
      const next = resolvePlayerMovement(player, player.x + dx, player.z + dz, config);
      const moved = Math.hypot(next.x - player.x, next.z - player.z);
      player.x = next.x;
      player.y = next.y;
      player.z = next.z;
      const door = crossedDoor(before, player, config.interactables);
      if (door) { keys.clear(); triggerInteraction(door); return; }
      if (moved > 0.001) {
        bobPhase += moved * 3.6;
        stepDistance += moved;
        if (stepDistance >= 2.2) {
          stepDistance = 0;
          motion?.tone?.(1, false);
        }
      }
    }
    syncCamera();
    updateTargetPrompt();
  }

  function nudgeMove(dir) {
    const step = 0.45;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    let dx = 0, dz = 0;
    if (dir === 'forward') { dx = -sin * step; dz = -cos * step; }
    else if (dir === 'back') { dx = sin * step; dz = cos * step; }
    else if (dir === 'left') { dx = -cos * step; dz = sin * step; }
    else if (dir === 'right') { dx = cos * step; dz = -sin * step; }
    const before = { ...player };
    const next = resolvePlayerMovement(player, player.x + dx, player.z + dz, config);
    player.x = next.x; player.y = next.y; player.z = next.z;
    const door = crossedDoor(before, player, config.interactables);
    if (door) { triggerInteraction(door); return; }
    syncCamera();
    updateTargetPrompt();
  }

  // Event Listeners
  const listen = (el, type, fn, opts) => el.addEventListener(type, fn, { signal, ...opts });

  listen(window, 'resize', updateSize);
  function requestLook() {
    if (!viewport.requestPointerLock) return;
    Promise.resolve(viewport.requestPointerLock()).catch(() => {
      help.hidden = false;
      help.textContent = '鼠标锁定不可用，可按住画面拖动环视';
    });
  }
  listen(document, 'pointerlockchange', () => {
    const wasLocked = pointerLocked;
    pointerLocked = document.pointerLockElement === viewport;
    root.dataset.pointerLocked = String(pointerLocked);
    if (wasLocked && !pointerLocked) {
      keys.clear(); draggingLook = false;
      if (active && modal.hidden && !reading && !conversation) openSpatialOverviewModal();
    }
  });
  listen(viewport, 'click', () => viewport.focus({ preventScroll: true }));
  listen(viewport, 'dblclick', requestLook);

  listen(inspectorBtn, 'click', () => openSpatialOverviewModal());
  listen(modalClose, 'click', closeModal);
  listen(promptBtn, 'click', e => {
    e.stopPropagation();
    triggerInteraction(activeTarget);
  });

  listen(viewport, 'pointerdown', e => {
    if (reading || !modal.hidden || pointerLocked || e.button !== 0) return;
    draggingLook = true;
    lastPointer = { x: e.clientX, y: e.clientY };
  });
  listen(window, 'pointerup', () => { draggingLook = false; });
  listen(window, 'pointermove', e => {
    if (pointerLocked) {
      player.yaw -= (e.movementX || 0) * 0.0024;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - (e.movementY || 0) * 0.0022));
      syncCamera();
      updateTargetPrompt();
    } else if (draggingLook) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer = { x: e.clientX, y: e.clientY };
      player.yaw -= dx * 0.0045;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - dy * 0.004));
      syncCamera();
      updateTargetPrompt();
    }
  }, { passive: true });

  listen(window, 'keydown', e => {
    if (reading && active) {
      if (e.code === 'Escape') { e.preventDefault(); if (!closeModal()) library.onClose(); }
      if (e.code === 'Tab') {
        const controls = [...(modal.hidden ? readingObject.element : modal).querySelectorAll('button, a[href], input, select, textarea')].filter(el => !el.hidden && el.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    if (e.defaultPrevented || !active || shellBlocked() || e.target.matches?.('input, textarea, select')) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!closeModal()) openSpatialOverviewModal();
      return;
    }
    if (!modal.hidden) {
      if (e.code === 'Tab') {
        const buttons = [...modal.querySelectorAll('button, a[href]')];
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyR'].includes(e.code)) {
      keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      triggerInteraction(activeTarget);
    } else if (e.code === 'KeyM' || e.code === 'Tab') {
      if (e.code === 'KeyM') {
        e.preventDefault();
        openSpatialOverviewModal();
      }
    }
  });

  listen(window, 'keyup', e => {
    keys.delete(e.code);
  });

  root.querySelectorAll('[data-step], [data-turn]').forEach(btn => {
    const code = btn.dataset.step
      ? { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' }[btn.dataset.step]
      : btn.dataset.turn === 'left' ? 'ArrowLeft' : 'ArrowRight';
    listen(btn, 'pointerdown', e => {
      e.preventDefault(); keys.add(code); btn.setPointerCapture(e.pointerId);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(btn, event, () => keys.delete(code));
    listen(btn, 'click', e => { if (e.detail === 0 && btn.dataset.step) nudgeMove(btn.dataset.step); });
  });
  listen(root.querySelector('[data-touch-interact]'), 'click', () => {
    if (activeTarget) triggerInteraction(activeTarget);
    else openSpatialOverviewModal();
  });

  function shellBlocked() {
    const shell = root.closest('#p34-space');
    return shell.dataset.map === 'true' || shell.dataset.talking === 'true';
  }

  listen(window, 'blur', () => { keys.clear(); draggingLook = false; });
  listen(document, 'visibilitychange', () => setActive(!document.hidden && root.closest('#p34-space').dataset.room === (library ? 'blog' : 'home')));

  function animate(now) {
    if (signal?.aborted || !active || disposed) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    if (!reading && modal.hidden && !shellBlocked()) stepMovement(dt);
    if (!reading && modal.hidden && !shellBlocked()) for (const fn of animatedObjects) fn(dt);
    if (renderer) renderer.render(scene, camera);
    if (reading) pageRenderer.render(pages, camera);
    if (renderer && typography) {
      renderer.clearDepth(); renderer.autoClear = false;
      typography.render(renderer, dt);
      renderer.autoClear = true;
    }
    rafId = requestAnimationFrame(animate);
  }

  updateSize();
  rebuildLayerScene();
  rafId = requestAnimationFrame(animate);

  function setActive(value) {
    active = value && !disposed;
    keys.clear(); draggingLook = false;
    cancelAnimationFrame(rafId);
    if (active) { lastTime = performance.now(); rafId = requestAnimationFrame(animate); }
    else if (document.pointerLockElement === viewport) document.exitPointerLock?.();
  }

  const api = {
    setActive,
    readBook,
    setDialogue,
    getLayer: () => currentLayerId,
    getPlayer: () => ({ ...player }),
    getActiveTarget: () => activeTarget,
    getInteractables: () => config.interactables.map(i => ({ ...i })),
    switchLayer: (l, opts) => switchLayer(l, opts),
    teleport(x, z, yaw = player.yaw, pitch = player.pitch) {
      player.x = x;
      player.z = z;
      player.yaw = yaw;
      player.pitch = pitch;
      player.y = computeFloorElevation(player.x, player.z, player.y || 0, config.surfaces);
      syncCamera();
      updateTargetPrompt();
      return { ...player };
    },
    interact(id) {
      const target = id ? config.interactables.find(i => i.id === id) : activeTarget;
      return triggerInteraction(target);
    },
    refresh() {
      state = getState();
      if (!library && state.currentLayer && state.currentLayer !== currentLayerId && LAYERS.includes(state.currentLayer)) {
        currentLayerId = state.currentLayer;
        config = getLayerConfig(currentLayerId, state);
        player = { ...config.spawn };
      }
      rebuildLayerScene();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (document.pointerLockElement === viewport) document.exitPointerLock?.();
      clearScene();
      if (readingObject) pages.remove(readingObject);
      typography?.dispose();
      renderer?.dispose?.();
      root.remove();
    },
  };

  container.__p34World = api;
  if (typeof window !== 'undefined') window.__p34World = api;
  signal?.addEventListener('abort', () => api.dispose(), { once: true });
  return api;
}
