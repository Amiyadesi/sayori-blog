import {
  LAYERS,
  LAYER_LABELS,
  TARGET_PILLARS,
  CLUE_INFO,
  GARDEN_SKIES,
} from './p34-journey.js?v=20261113-library';
import { createBuilding } from './p34-building.js?v=20261113-residents';
import { addResidents } from './p34-residents.js?v=20261113-residents';
import { createWorldAudio } from './p34-audio.js?v=20261114-surreal';
import { SUNDIAL, CHIMES, GARDEN_LIGHT, skyFromHour, entrySpawn, inPool, dailyNote, addAtriumGarden, addStacksGarden, addLoftGarden } from './p34-garden.js?v=20261119-garden';
import { LINES } from './p34-script.js?v=20261119-garden';

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
  ...[-1, 1].map(side => ({ x: side * 3.5, z: -9.55, w: 4, d: .3, h: 4, y: 3.2 })),
  { x: 0, z: -9.55, w: 3, d: .3, h: 1, y: 6.2 },
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
        { id: 'garden-sundial', label: '光晷仪', prompt: 'E · 转动', kind: 'garden-sundial', ...SUNDIAL },
        { id: 'corridor-chimes', label: '铜风铃', prompt: 'E · 轻拨', kind: 'corridor-chimes', ...CHIMES },
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
        ...(state.phase === 'arrive' ? [{
          id: 'arrival-echo',
          label: '她',
          prompt: 'E · 问问她',
          x: 0, y: 1.55, z: 5.2,
          kind: 'talk-arrival',
        }] : []),
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
        ...['lamp', 'folio', 'blank'].map((specimen, i) => ({ id: `specimen-${specimen}`, label: ['桌灯标本', '笔记折页', '第 34 号空白铭牌'][i], prompt: 'E · 近看', kind: 'garden-specimen', specimen, x: [-7.2, -4.6, 7.2][i], y: 1.15, z: 8.3 })),
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
      { id: 'loft-daily-note', label: '桌边短笺', prompt: 'E · 翻看', kind: 'loft-daily-note', x: -3.1, y: 1.05, z: 2.3 },
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
  onArrivalReveal,
  onLayerChange,
  onShelfMoved,
  onGardenComment,
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
        <span class="world3d-touch-stick-nub" data-stick-nub aria-hidden="true"></span>
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
        <button type="button" class="world3d-touch-interact" data-touch-interact data-active="false">环视</button>
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
  const modalCard = root.querySelector('.world3d-modal-card');
  const modalClose = root.querySelector('[data-modal-close]');
  const touchInteractBtn = root.querySelector('[data-touch-interact]');
  const touchMovePad = root.querySelector('[data-touch-move]');
  const stickNub = root.querySelector('[data-stick-nub]');
  const audio = createWorldAudio({ motion, signal });

  let renderer = null;
  let webglAvailable = true;
  try {
    let isSoftwareGL = false;
    try {
      const probe = document.createElement('canvas').getContext('webgl');
      const dbg = probe?.getExtension('WEBGL_debug_renderer_info');
      const glName = dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      isSoftwareGL = /SwiftShader|llvmpipe|Software/i.test(glName);
    } catch {}
    renderer = new THREE.WebGLRenderer({ antialias: !isSoftwareGL, powerPreference: 'high-performance' });
    // Software rasterizers are fill-rate bound; preserve lighting rather than strip the room's shadows.
    renderer.setPixelRatio(isSoftwareGL ? .75 : Math.min(window.devicePixelRatio || 1, 1.5));
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
    residents?.triggerArrivalDissolve?.(true);
    if (currentLayerId === 'atrium' && getState().phase !== 'arrive') config.interactables = config.interactables.filter(i => i.kind !== 'talk-arrival');
    if (!renderer) return;
    const request = conversation;
    keys.clear(); draggingLook = false; lookPointerId = null; resetTouchStick();
    if (document.pointerLockElement === viewport) document.exitPointerLock?.();
    try {
      typographyMount ||= import('./p34-typography.js?v=20261113-library').then(m => m.createSpatialDialogue({ signal, reduced: motion.reduced }));
      typography = await typographyMount;
      if (disposed) { typography.dispose(); return; }
      if (conversation !== request) return;
      typography.show(conversation.text, conversation.buttons, viewport.clientWidth, viewport.clientHeight);
      shell.dataset.depthDialogue = 'true';
      audio.playInteraction('glyph');
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
  let player = !library && currentLayerId === 'atrium' ? entrySpawn(config.spawn, location.href) : { ...config.spawn };
  let bobPhase = 0;
  let stepDistance = 0;
  let lampColorIdx = 0;
  const LAMP_COLORS = [0x6cecff, 0xc39bff, 0xf6c979];

  const keys = new Set();
  let pointerLocked = false;
  let draggingLook = false;
  let lastPointer = { x: 0, y: 0 };
  let lookPointerId = null;
  let lookMoved = 0;
  let lookPointerType = 'mouse';
  const touchStick = { pointerId: null, originX: 0, originY: 0, dx: 0, dy: 0, analog: false, stepCode: null };
  function resetTouchStick() {
    if (touchStick.stepCode) keys.delete(touchStick.stepCode);
    touchStick.pointerId = null; touchStick.dx = 0; touchStick.dy = 0; touchStick.analog = false; touchStick.stepCode = null;
    if (touchMovePad) delete touchMovePad.dataset.stickActive;
    if (stickNub) stickNub.style.transform = '';
  }
  let activeTarget = null;
  let animatedObjects = [];
  let dynamicNorthBridgeGroup = null;
  let dynamicSlidingShelf = null;
  let lampLightRef = null;
  let residents = null;
  let building = null;
  let garden = null, gardenLighting = null, appliedSky = '', appliedChime = null;
  let preferenceTimer = 0;
  const gardenEchoes = new Set();
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
    keys.clear(); draggingLook = false; lookPointerId = null; resetTouchStick();
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
    garden?.dispose?.(); garden = null; gardenLighting = null; appliedSky = ''; appliedChime = null;
    const freed = new Set();
    for (const material of building?.materials || []) {
      for (const resource of [material.map, material.bumpMap, material]) {
        if (resource && !freed.has(resource)) { freed.add(resource); resource.dispose(); }
      }
    }
    building = null;
    scene.traverse(obj => {
      obj.shadow?.dispose();
      if (obj.isInstancedMesh) obj.dispose();
      const materials = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      for (const resource of [obj.geometry, ...materials.flatMap(m => [m.map, m.bumpMap, m])]) {
        if (resource && !freed.has(resource)) { freed.add(resource); resource.dispose(); }
      }
    });
    animatedObjects = [];
    dynamicNorthBridgeGroup = null;
    dynamicSlidingShelf = null;
    lampLightRef = null;
    residents = null;
    while (scene.children.length > 0) {
      const obj = scene.children[0];
      scene.remove(obj);
    }
  }

  function populateAtrium() {
    const version = buildId;
    scene.background = new THREE.Color(0x4d574e);
    scene.fog = new THREE.Fog(0x4d574e, 27, 65);

    const hemi = new THREE.HemisphereLight(0xeff0e8, 0x777b74, 1.35);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xf1ece0, 1.15);
    dir.position.set(18, 12, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    Object.assign(dir.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: .5, far: 65 });
    dir.shadow.normalBias = .16;
    dir.shadow.bias = -.00025;
    dir.shadow.autoUpdate = false; dir.shadow.needsUpdate = true;
    scene.add(dir);

    const centerLight = new THREE.PointLight(0xf4ebd9, 62, 24);
    centerLight.position.set(0, 6.8, 0);
    scene.add(centerLight);

    const westLight = new THREE.PointLight(0xdce8d1, 28, 17);
    westLight.position.set(-19.5, 4.1, 1.5);
    scene.add(westLight);

    const eastLight = new THREE.PointLight(LAMP_COLORS[lampColorIdx], 6, 13);
    eastLight.position.set(9.2, 2, -1.5);
    scene.add(eastLight);
    lampLightRef = eastLight;

    building = createBuilding(THREE, scene, renderer);
    const { box, floor: floorMat, ceiling: ceilingMat, wood: timber, metal } = building;
    box(27, .2, 25, 0, -.1, 0, floorMat);
    for (const wall of config.walls) {
      if (Math.abs(wall.x) === 24) {
        const east = wall.x > 0, z = east ? -5.5 : 12, width = east ? 3.8 : 5.9;
        const bottom = east ? 1.08 : 2.02, top = east ? 3.92 : 2.98;
        const start = wall.z - wall.d / 2, end = wall.z + wall.d / 2;
        building.wall(wall.w, wall.h, z - width / 2 - start, wall.x, 0, (start + z - width / 2) / 2);
        building.wall(wall.w, wall.h, end - z - width / 2, wall.x, 0, (end + z + width / 2) / 2);
        building.wall(wall.w, bottom, width, wall.x, 0, z);
        building.wall(wall.w, wall.h - top, width, wall.x, top, z);
      } else if (wall.z === 20) {
        for (const x of [-12.8, 12.8]) building.wall(22.4, wall.h, wall.d, x, 0, wall.z);
        building.wall(3.2, .4, wall.d, 0, 3, wall.z);
      } else building.wall(wall.w, wall.h, wall.d, wall.x, wall.y || 0, wall.z);
    }
    building.wall(.8, 4.5, 5.7, -7, 0, -3.35);
    for (const side of [-1, 1]) {
      box(10.5, .2, 29, side * 18.75, -.1, 5.5, floorMat);
      box(10.5, .2, 29, side * 18.75, 4.9, 5.5, ceilingMat);
    }
    box(27, .2, 7.5, 0, -.1, 16.25, floorMat);
    box(48, .2, 7.5, 0, 3.5, 16.25, ceilingMat);
    box(27, .25, 6.5, 0, 3.5, 9, ceilingMat);
    // A real open light well, not a glowing rectangle pasted on the ceiling.
    for (const x of [-8.35, 8.35]) box(10.3, .25, 18, x, 7.5, -3.5, ceilingMat);
    box(6.4, .25, 7.5, 0, 7.5, -8.75, ceilingMat);
    box(6.4, .25, 4, 0, 7.5, 3.5, ceilingMat);
    for (const x of [-3.2, 3.2]) box(.18, 1.5, 6.5, x, 8.15, -1.75, building.plaster);
    for (const z of [-5, 1.5]) box(6.4, 1.5, .18, 0, 8.15, z, building.plaster);
    const skylight = box(6.4, .06, 6.5, 0, 8.9, -1.75, new THREE.MeshBasicMaterial({ color: 0xe5e5d9 }));
    gardenLighting = { hemi, dir, centerLight, skylight };
    for (const [x, y, z] of [[-2, 3.3, 9], [2, 3.3, 9], [-6, 7.3, -1], [6, 7.3, -1], [-9.3, 7.3, -7], [-20.5, 4.7, -5.5], [-16, 4.7, 3.5], [-20.5, 4.7, 11], [21, 4.7, -5.5], [16, 4.7, 5.5], [21, 4.7, 11], [9, 3.3, 16]]) building.fixture(x, y, z, true);
    const flickerTube = building.fixture(-10, 3.3, 17, true);
    animatedObjects.push(() => {
      if (motion?.reduced?.()) return;
      const t = performance.now() * 0.001;
      const dip = Math.sin(t * 7.3) * Math.sin(t * 19.1) > 0.72 ? 0.42 : 1.0;
      flickerTube.material.emissiveIntensity = 1.8 * dip;
    });
    const southLight = new THREE.PointLight(0xe6e5cb, 24, 17);
    southLight.position.set(2.5, 3.0, 12.5);
    scene.add(southLight);
    building.vent(-23.72, 3.7, 1, -1); building.vent(23.72, 3.7, 7);

    // Quiet rooms look out onto impossible liminal courtyards rather than flat white planes.
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbac7ba, transparent: true, opacity: .24, roughness: .18, metalness: .1 });
    const fogCourtMat = new THREE.MeshBasicMaterial({ color: 0x9aa69a });
    const ghostArchMat = new THREE.MeshBasicMaterial({ color: 0x7a857c });
    const eastGlass = box(.04, 2.8, 3.5, 23.74, 2.5, -5.5, glassMat); eastGlass.userData.noShadow = true; eastGlass.userData.noReceiveShadow = true;
    // Impossible East Courtyard diorama beyond glass (X: 24..34)
    box(.1, 7, 11, 34, 3, -5.5, fogCourtMat).userData.noShadow = true;
    box(10, .1, 11, 29, 6.5, -5.5, fogCourtMat).userData.noShadow = true;
    box(10, .1, 11, 29, -.5, -5.5, fogCourtMat).userData.noShadow = true;
    for (let s = 0; s < 6; s++) box(1.8, .22, .48, 28.5, .4 + s * .42, -3.2 - s * .72, ghostArchMat).userData.noShadow = true;
    const tiltedFrame = new THREE.Group();
    tiltedFrame.position.set(30.8, 3.2, -7.2); tiltedFrame.rotation.x = .14;
    for (const z of [-1.05, 1.05]) box(.22, 3.1, .14, 0, 0, z, ghostArchMat, tiltedFrame);
    for (const y of [-1.55, 1.55]) box(.22, .14, 2.1, 0, y, 0, ghostArchMat, tiltedFrame);
    scene.add(tiltedFrame);

    for (const z of [-6.65, -5.5, -4.35]) box(.12, 2.8, .045, 23.65, 2.5, z, timber);
    for (const y of [1.08, 2.35, 3.92]) box(.2, .09, 3.8, 23.6, y, -5.5, metal);
    box(.35, .12, 3.9, 23.5, 1.04, -5.5, building.plaster);
    box(1.15, .16, 3.6, 22.7, .5, -5.5, timber);
    box(.15, .5, 3.4, 22.7, .25, -5.5, timber);
    box(.04, .9, 5.8, -23.74, 2.5, 12, glassMat).castShadow = false;
    // Inverted corridor vista beyond West Clerestory (X: -32..-24)
    box(.1, 5, 9, -32, 2.5, 12, fogCourtMat).castShadow = false;
    box(7, .12, 6, -28, .2, 12, new THREE.MeshBasicMaterial({ color: 0xc2cbc0 })).castShadow = false;
    building.deepPortal(-25.1, 0, 12, 2.9, 4.3, Math.PI / 2, 7, 0x68736b);
    for (const z of [9.1, 10.55, 12, 13.45, 14.9]) box(.1, 1, .05, -23.62, 2.5, z, metal);
    for (const y of [2.02, 2.98]) box(.2, .08, 5.9, -23.6, y, 12, metal);
    box(1.1, .18, 4, -22.9, .5, 12, timber);
    box(.16, .5, 3.8, -22.9, .25, 12, timber);
    box(4.7, .18, 6, 21.15, 2.11, 11, floorMat);
    box(4.7, .12, .12, 21.15, 3.05, 8, timber);
    for (const x of [18.8, 20.35, 21.9, 23.5]) box(.05, .85, .05, x, 2.63, 8, timber);
    for (let i = 0; i < 10; i++) box(2.6, .22, .4, 21.3, .11 + i * .22, 17.8 - i * .4, floorMat);
    for (const z of [8.2, 10, 11.8]) box(.12, 2.2, .06, 13.5, 3.8, z, timber);

    // Inverted chair mounted quietly on the rear ceiling (subtle non-Euclidean cue)
    const invChair = new THREE.Group();
    invChair.position.set(-14.5, 3.4, 16.4);
    invChair.rotation.set(Math.PI, .38, 0);
    box(.48, .05, .48, 0, .48, 0, timber, invChair);
    box(.48, .5, .05, 0, .75, -.21, timber, invChair);
    for (const lx of [-.2, .2]) for (const lz of [-.2, .2]) box(.045, .48, .045, lx, .24, lz, timber, invChair);
    invChair.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
    scene.add(invChair);

    // Recessed page-seam veil + infinite south rear portal
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x565950, transparent: true, opacity: .62, side: THREE.DoubleSide });
    const seamMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.2), seamMat);
    seamMesh.position.set(0, 1.6, 12.1);
    scene.add(seamMesh);
    building.deepPortal(0, 0, 19.78, 3.2, 3.0, Math.PI, 4, 0x242a26);

    // Four central chamfered monolith columns
    for (const [cx, cz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      building.column(1.1, 7.4, 1.1, cx, 0, cz);
    }

    // The west stairs are ordinary architecture, not an invisible sightline lock.
    const stepCount = 10;
    for (let i = 0; i < stepCount; i++) {
      const t = i / (stepCount - 1);
      box(3.4, .24, .48, -9.4, .2 + t * 3, -2 - t * 4.6, floorMat);
      box(3.4, .03, .045, -9.4, .33 + t * 3, -1.78 - t * 4.6, metal);
    }

    // Upper Mezzanine Balcony (Y = 3.2m, Z = -8.6)
    const mezzDeck = new THREE.Mesh(
      new THREE.BoxGeometry(19.0, 0.3, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x888a7d, roughness: 1 })
    );
    mezzDeck.position.set(-2.0, 3.05, -8.6);
    scene.add(mezzDeck);

    // The opening belongs to the upper wall, receding into a non-Euclidean threshold corridor.
    for (const x of [-1.5, 1.5]) {
      box(.1, 3, .56, x, 4.7, -9.6, metal);
    }
    box(3.1, .1, .56, 0, 6.2, -9.6, metal);
    building.deepPortal(0, 3.2, -9.68, 2.9, 2.96, 0, 5, 0x1b211f);

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

    box(1.4, .1, 1.2, 0, .9, 1.2, timber);
    for (const x of [-.57, .57]) for (const z of [.75, 1.65]) box(.055, .85, .055, x, .425, z, metal);
    box(1.2, .12, .04, 0, .68, 1.65, metal);
    const foldedPaper = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.7), new THREE.MeshStandardMaterial({ color: 0xd4d2c6, roughness: 1 }));
    foldedPaper.position.set(0, 0.96, 1.2);
    foldedPaper.rotation.z = 0.15;
    scene.add(foldedPaper);

    // Saved sketch produces a usable bridge, not a decorative ribbon.
    if (state.bridgeSolid) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 4.4), new THREE.MeshStandardMaterial({ color: 0xb9c8d0, roughness: 0.8 }));
      bridge.position.set(0, 3.34, -12.2);
      bridge.rotation.x = Math.atan2(0.4, 4.4);
      scene.add(bridge);
    }

    // East Wing: Pedestals + GLB models + Backstage Webpage Terminal
    const pedGeom = new THREE.CylinderGeometry(0.55, 0.65, 1.0, 16);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0xc7c8b9, roughness: .82 });
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
    garden = addAtriumGarden(THREE, scene, renderer, building, { reduced: motion.reduced, getPlayer: () => player, onNotice: () => onGardenComment?.(LINES.garden.moved[0]) });
    animatedObjects.push(dt => garden.update(dt));
    residents = addResidents(THREE, scene, config, () => player, motion.reduced, {
      layerId: 'atrium',
      showArrival: state.phase === 'arrive',
      onArrivalReveal,
      onArrivalDissolve: () => audio.playInteraction('paper'),
      isDialogueOpen: () => Boolean(conversation),
      onEntityGlance: () => audio.playInteraction('entity-hide'),
      onRipple: (x, z, small) => garden.ripple(x, z, small),
    });
    animatedObjects.push(dt => residents.update(dt));
    if (state.phase === 'arrive') {
      void import('./third-party/three/FontLoader.js').then(async ({ FontLoader }) => {
        const response = await fetch('/assets/p34/dialogue.typeface.json', { signal });
        if (!response.ok) throw new Error(`Arrival font: HTTP ${response.status}`);
        const font = new FontLoader().parse(await response.json());
        if (!disposed && version === buildId) residents.setArrivalFont(font);
      }).catch(error => { if (!signal?.aborted) console.error('Arrival lettering failed to load', error); });
    }
    scene.traverse(object => {
      if (object.isMesh) {
        object.receiveShadow = !object.userData.noReceiveShadow && object.material.isMeshStandardMaterial && object.material !== ceilingMat;
        object.castShadow = !object.userData.noShadow && object.material.isMeshStandardMaterial && !object.material.transparent && object.material !== ceilingMat;
      }
    });
  }

  function populateStacks() {
    scene.background = new THREE.Color(0x202b30);
    scene.fog = new THREE.Fog(0x202b30, 20, 60);

    const hemi = new THREE.HemisphereLight(0xd7dedc, 0x4b5154, 1.35);
    scene.add(hemi);
    const daylight = new THREE.DirectionalLight(0xd7dedc, .38); daylight.position.set(-10, 12, -8); scene.add(daylight);
    gardenLighting = { hemi, dir: daylight };

    const westPool = new THREE.PointLight(0xe5cfa0, 14, 16);
    westPool.position.set(-7.0, 3.6, 0.8);
    const eastPool = new THREE.PointLight(0xe5cfa0, 14, 16);
    eastPool.position.set(7.0, 3.6, 0.8);
    const projLight = new THREE.PointLight(state.stacksUnlocked ? 0xc2e8d4 : (state.diagram ? 0xe6dca8 : 0x9ab3c4), 16, 20);
    projLight.position.set(0, 3.8, -3.5);
    scene.add(westPool, eastPool, projLight);

    building = createBuilding(THREE, scene, renderer, { tone: 'stacks' });
    const { box, floor: floorMat, wood: timber, metal, plaster } = building;
    box(24, .3, 19.6, 0, -.15, 2.2, floorMat);

    // Enclosing concrete archive walls & high suspended ceiling coffers
    for (const side of [-1, 1]) {
      building.wall(.45, 13, 25.5, side * 11.75, 0, -1.0);
    }
    building.wall(10.1, 7.5, .45, -6.7, 0, 11.6);
    building.wall(10.1, 7.5, .45, 6.7, 0, 11.6);
    box(3.8, 3.7, .45, 0, 5.65, 11.6, plaster);
    box(24, .25, 25.5, 0, 12.8, -1.0, building.ceiling);
    for (const z of [-9, -3, 3, 9]) box(23.5, .45, .42, 0, 12.2, z, metal);
    for (const x of [-6.5, 6.5]) for (const z of [-4, 4]) {
      box(.03, 5.4, .03, x, 10.1, z, metal);
      building.fixture(x, 7.4, z, true);
    }
    building.vent(-11.45, 4.2, 6.5, -1);
    building.vent(11.45, 4.2, 6.5, 1);

    // Abyssal shaft beyond north ledge (Y < 0 descending into mist)
    const abyssMat = new THREE.MeshStandardMaterial({ color: 0x2c3336, roughness: 1 });
    for (const side of [-1, 1]) box(.4, 14, 7.5, side * 11.75, -7, -11.2, abyssMat);
    box(24, 14, .4, 0, -7, -14.2, abyssMat);
    for (let depth = 1; depth <= 3; depth++) {
      box(4.4, .18, 1.4, 0, -depth * 3.2, -10.8, abyssMat);
    }
    // Buttresses, remote stacks and a high gallery give the northern void a human scale.
    box(26, 29, .5, 0, 1, -22, abyssMat);
    for (const x of [-10.5, -7, -3.5, 3.5, 7, 10.5]) {
      building.column(.7, 25, 1.1, x, -12, -18.8);
      box(2.5, .22, 2.5, x, 7, -19.6, metal);
      for (const y of [7.8, 9.2, 10.6]) {
        box(2.3, .12, .85, x, y, -20.2, timber);
        for (let b = 0; b < 6; b++) box(.19, .55 + (b % 3) * .09, .48, x - .9 + b * .35, y + .36, -20.2, metal);
      }
    }
    box(23, .4, 2.2, 0, 6.4, -16.4, metal);
    box(23, .08, .08, 0, 7.65, -15.35, metal);
    for (let x = -11; x <= 11; x += 1.1) box(.045, 1, .045, x, 7.1, -15.35, metal);
    building.deepPortal(0, 6.6, -21.7, 1.6, 3.2, 0, 5, 0x111a1e);
    box(.045, 2.6, .04, .58, 8, -21.45, new THREE.MeshBasicMaterial({ color: 0x9baea5 }));

    // Towering Archive Bookstacks + Instanced Books ascending into upper mist
    const spineMat = new THREE.MeshStandardMaterial({ color: 0xa6a394, roughness: .95 });
    for (let i = 0; i < 6; i++) {
      const z = -6.0 + i * 2.8;
      for (const side of [-1, 1]) {
        box(1.5, 12.5, 1.85, side * 10.0, 6.25, z, metal);
        box(1.56, .28, 1.5, side * 10.0, 2.2 + (i % 3) * 1.4, z, spineMat);
        for (let row = 0; row < 6; row++) {
          box(1.9, .08, 1.82, side * 9.4, 1.0 + row * 1.05, z, timber);
        }
      }
    }
    const stackBooks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .95 }), 2 * 6 * 6 * 7);
    const bPose = new THREE.Object3D(), bColors = [0x8c8a76, 0x5c6862, 0x7b7163, 0x67706d, 0x999581];
    let bIdx = 0;
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const z = -6.0 + i * 2.8;
      for (let row = 0; row < 6; row++) for (let k = 0; k < 7; k++) {
        if ((i + k + row) % 5 === 0) continue;
        const h = .38 + ((k * 5 + row) % 7) * .025;
        bPose.position.set(side * 9.15, 1.04 + row * 1.05 + h / 2, z - .72 + k * .23);
        bPose.scale.set(.52, h, .12 + (k % 3) * .03);
        bPose.rotation.x = (k + row) % 8 === 3 ? .14 : 0;
        bPose.updateMatrix();
        stackBooks.setMatrixAt(bIdx, bPose.matrix);
        stackBooks.setColorAt(bIdx++, new THREE.Color(bColors[(i + k + row) % bColors.length]));
      }
    }
    stackBooks.count = bIdx;
    scene.add(stackBooks);

    // Sovereign Girl's sliding bookshelf (full framed rack with books)
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(state.shelfMoved ? -5.2 : -1.2, 0, 4.2);
    box(3.2, 4.1, .16, 0, 2.05, -.32, metal, shelfGroup);
    for (const sx of [-1.54, 1.54]) box(.12, 4.1, .8, sx, 2.05, 0, metal, shelfGroup);
    for (let row = 0; row < 5; row++) {
      box(3.05, .08, .76, 0, .42 + row * .86, 0, timber, shelfGroup);
      for (let b = 0; b < 11; b++) {
        if ((row + b) % 4 === 2) continue;
        box(.14, .42 + (b % 3) * .07, .55, -1.28 + b * .25, .67 + row * .86, 0, b % 2 ? spineMat : timber, shelfGroup);
      }
    }
    dynamicSlidingShelf = shelfGroup;
    scene.add(dynamicSlidingShelf);
    if (!state.shelfMoved) {
      let elapsed = 0;
      let playedSlideAudio = false;
      animatedObjects.push(dt => {
        if (!playedSlideAudio) { playedSlideAudio = true; audio.playInteraction('shelf'); }
        elapsed += dt;
        dynamicSlidingShelf.position.x = -1.2 - 4 * Math.min(1, elapsed / 1.6);
        if (elapsed >= 1.6 && !state.shelfMoved) {
          onShelfMoved?.();
          state = getState();
          config = getLayerConfig(currentLayerId, state);
        }
      });
    }

    // West Blog Desk & East Relic Desk with legs, open books, and bound folios
    building.desk(-7.2, 0, 0.8, 2.0, 1.3, 1.1, timber, metal);
    building.desk(7.2, 0, 0.8, 2.0, 1.3, 1.1, timber, metal);
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xcbc6b4, roughness: .95, side: THREE.DoubleSide });
    const leftPage = box(.34, .03, .48, -7.38, 1.12, 0.8, paperMat); leftPage.rotation.z = .08;
    const rightPage = box(.34, .03, .48, -7.02, 1.12, 0.8, paperMat); rightPage.rotation.z = -.08;
    box(.62, .16, .48, 7.2, 1.18, 0.8, paperMat).rotation.y = .18;
    box(.56, .1, .44, 7.24, 1.31, 0.82, spineMat).rotation.y = -.1;

    // Optical Brass Overhead Projector on pedestal
    building.desk(0, 0, -0.8, 1.0, 1.0, 0.72, metal, metal);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0x9d8a5e, roughness: .42, metalness: .62 });
    box(.56, .25, .64, 0, .88, -.8, brassMat);
    box(.05, .65, .05, .24, 1.25, -1.03, brassMat);
    box(.42, .05, .05, .05, 1.58, -1.03, brassMat);
    const lensGlow = new THREE.MeshStandardMaterial({ color: 0xc1d9d0, emissive: 0x789d8c, emissiveIntensity: .7, roughness: .18, metalness: .2 });
    box(.42, .018, .45, 0, 1.02, -.8, lensGlow);
    const optic = new THREE.Mesh(new THREE.TorusGeometry(.13, .024, 10, 40), brassMat);
    optic.position.set(0, 1.53, -1.03); optic.rotation.x = Math.PI / 2;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .025, 32), lensGlow);
    lens.position.copy(optic.position);
    scene.add(optic, lens);
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x9bb4a9, transparent: true, opacity: state.diagram ? .48 : .2, depthWrite: false });
    for (const radius of [.72, .83]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + .012, 72), reticleMat);
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, .012, -3.1); scene.add(ring);
    }
    for (const x of [-7.8, 7.8]) {
      box(.32, .035, .26, x, 1.12, .6, brassMat);
      box(.035, .6, .035, x, 1.42, .6, brassMat);
      const shade = new THREE.Mesh(new THREE.SphereGeometry(.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brassMat);
      shade.position.set(x, 1.73, .6); scene.add(shade);
      box(.38, .025, .26, x, 1.71, .6, new THREE.MeshBasicMaterial({ color: 0xf1cf8c }));
      const glow = new THREE.PointLight(0xf6c77b, 3.5, 4.5); glow.position.set(x, 1.58, .6); scene.add(glow);
    }

    // Three Fluted Stone & Astrolabe Index Pillars
    const p = state.pillars || { west: 'void', center: 'ground', east: 'noise' };
    const angleFor = (key, val) => {
      const idx = { west: ['void', 'seam', 'blind'], center: ['ground', 'mezzanine', 'loft'], east: ['noise', 'roof', 'rain'] }[key].indexOf(val);
      return (Math.max(0, idx) - 1) * 1.05;
    };
    const pillarSpecs = [
      { key: 'west', x: -4.2, z: -4.2, match: p.west === TARGET_PILLARS.west, val: p.west },
      { key: 'center', x: 0, z: -5.2, match: p.center === TARGET_PILLARS.center, val: p.center },
      { key: 'east', x: 4.2, z: -4.2, match: p.east === TARGET_PILLARS.east, val: p.east },
    ];
    for (const spec of pillarSpecs) {
      const group = new THREE.Group();
      group.position.set(spec.x, 0, spec.z);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.42, .48, 2.35, 64), plaster);
      col.position.y = 1.18;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.54, .48, .16, 12), metal);
      cap.position.y = 2.38;
      const ringMat = new THREE.MeshStandardMaterial({
        color: spec.match ? 0xcfd6be : 0x9c8b61,
        emissive: spec.match ? 0x455948 : 0x1e1910,
        roughness: .4, metalness: .65,
      });
      for (let f = 0; f < 24; f++) {
        const a = f / 24 * Math.PI * 2;
        box(.013, 2.05, .013, Math.sin(a) * .45, 1.15, Math.cos(a) * .45, metal, group);
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.58, .6, .14, 48), metal);
      base.position.y = .07; group.add(base);
      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(.56, .022, 10, 64), ringMat);
      outerRing.position.y = 2.95;
      outerRing.rotation.y = angleFor(spec.key, spec.val);
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(.46, .016, 10, 64), ringMat);
      innerRing.position.y = 2.95; innerRing.rotation.set(.48, angleFor(spec.key, spec.val) + .72, 0);
      const needle = new THREE.Mesh(new THREE.ConeGeometry(.055, .82, 4), ringMat);
      needle.position.y = 2.95;
      needle.rotation.y = angleFor(spec.key, spec.val);
      needle.rotation.z = -.55;
      group.add(col, cap, outerRing, innerRing, needle);
      scene.add(group);
      const scaleRing = new THREE.Mesh(new THREE.RingGeometry(.72, .735, 72), brassMat);
      scaleRing.rotation.x = -Math.PI / 2; scaleRing.position.set(spec.x, .012, spec.z); scene.add(scaleRing);
      for (let tick = 0; tick < 12; tick++) {
        const a = tick / 12 * Math.PI * 2;
        const mark = box(.012, .008, tick % 3 ? .07 : .13, spec.x + Math.sin(a) * .81, .015, spec.z + Math.cos(a) * .81, brassMat);
        mark.rotation.y = a;
      }
      const lead = box(.016, .008, Math.hypot(spec.x, spec.z + 7.3), spec.x / 2, .012, (spec.z - 7.3) / 2, brassMat);
      lead.rotation.y = Math.atan2(-spec.x, -7.3 - spec.z);
    }

    // North Frosted-Slate Suspension Bridge & Infinite Threshold Portal to Loft
    dynamicNorthBridgeGroup = new THREE.Group();
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: state.stacksUnlocked ? 0xaab5ad : 0x5c686b,
      emissive: state.stacksUnlocked ? 0x26332d : 0x111719,
      roughness: .72, transparent: !state.stacksUnlocked, opacity: state.stacksUnlocked ? .96 : .28,
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, .22, 6.2), bridgeMat);
    slab.position.set(0, .19, -10.4);
    slab.rotation.x = Math.atan2(.6, 6.6);
    dynamicNorthBridgeGroup.add(slab);
    if (state.stacksUnlocked) {
      for (const side of [-1.72, 1.72]) {
        for (const z of [-7.6, -10.3, -13.2]) box(.045, .9, .045, side, .45 + (-7.2 - z) / 6.6 * .6, z, metal, dynamicNorthBridgeGroup);
        const rail = box(.06, .06, 6.2, side, 1.2, -10.4, timber, dynamicNorthBridgeGroup);
        rail.rotation.x = slab.rotation.x;
      }
    }
    scene.add(dynamicNorthBridgeGroup);

    for (const z of [-12.2, 10.8]) {
      for (const x of [-1.7, 1.7]) box(.32, 3.8, .42, x, 1.9, z, plaster);
      box(3.7, .32, .42, 0, 3.8, z, plaster);
    }
    building.deepPortal(0, .35, -12.35, 3.1, 3.5, 0, 5, 0x23201b);
    building.deepPortal(0, 0, 10.95, 3.1, 3.5, Math.PI, 4, 0x1b211f);

    garden = addStacksGarden(THREE, scene, building, motion.reduced);
    animatedObjects.push(dt => garden.update(dt));
    residents = addResidents(THREE, scene, config, () => player, motion.reduced, {
      layerId: 'stacks',
      isDialogueOpen: () => Boolean(conversation),
      onEntityGlance: () => audio.playInteraction('entity-hide'),
    });
    animatedObjects.push(dt => residents.update(dt));
  }

  function populateLibrary() {
    scene.background = new THREE.Color(0x65746c);
    scene.fog = new THREE.Fog(0x65746c, 20, 55);
    scene.add(new THREE.HemisphereLight(0xe4e7df, 0x575b59, 1.25));
    const daylight = new THREE.DirectionalLight(0xe4e8e0, 1.1);
    daylight.position.set(9, 10, -8); scene.add(daylight);
    building = createBuilding(THREE, scene, renderer);
    const { box, plaster, wood: timber } = building;
    timber.color.setHex(0x5d685c);
    const paper = new THREE.MeshStandardMaterial({ color: 0xc6c3ae, roughness: 1 });
    box(23, .25, 32, 0, -.125, -4, building.floor);
    box(23, .25, 32, 0, 8, -4, building.ceiling);
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
        }
      }
      for (const z of [-9, 1]) {
        box(.8, 8, .8, side * 3.2, 4, z, plaster);
        box(6.6, .45, .8, side * 6.5, 7.6, z, plaster);
      }
    }
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), 6 * 7 * 18);
    const pose = new THREE.Object3D(), colors = [0x9c9a80, 0x5f7063, 0x908575, 0x6f7975, 0x727063, 0xafad94];
    let bookIndex = 0;
    for (const side of [-1, 1]) for (const z of [-14, -4, 6]) for (let row = 1; row <= 7; row++) for (let i = 0; i < 20; i++) {
      if (i % 7 === 6) continue;
      const h = .4 + ((i * 7 + row * 3) % 9) * .019;
      pose.position.set(side * 8.4 - side * .4, row * .85 + .05 + h / 2, z - 2.7 + i * .27);
      pose.scale.set(.6, h, .13 + (i % 3) * .035); pose.rotation.x = i % 9 === 4 ? .12 : 0; pose.updateMatrix();
      books.setMatrixAt(bookIndex, pose.matrix); books.setColorAt(bookIndex++, new THREE.Color(colors[(i + row) % colors.length]));
    }
    books.count = bookIndex; scene.add(books);
    for (const z of [-14, -4, 6]) {
      for (const x of [-4.7, 4.7]) building.fixture(x, 7.75, z, true);
      const pool = new THREE.PointLight(0xe6e4c9, 28, 12); pool.position.set(0, 7, z); scene.add(pool);
    }
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xbfcfc9 });
    box(.05, 3.2, 6, 11.24, 3.8, -9, windowMat);
    for (const z of [-12, -10.5, -9, -7.5, -6]) box(.15, 3.3, .055, 11.15, 3.8, z, building.metal);
    for (const y of [2.15, 3.8, 5.45]) box(.2, .08, 6.1, 11.12, y, -9, building.metal);
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
    scene.background = new THREE.Color(0x2a292b);
    scene.fog = new THREE.Fog(0x2a292b, 10, 34);

    const hemi = new THREE.HemisphereLight(0xe6dccb, 0x615950, 1.4);
    scene.add(hemi);

    const warmLamp = new THREE.PointLight(0xf3cc94, 27, 15);
    warmLamp.position.set(0.3, 3.1, -1.4);
    const windowLight = new THREE.PointLight(0x88b8cc, 10, 14);
    windowLight.position.set(0, 2.8, -6.2);
    scene.add(warmLamp, windowLight);

    building = createBuilding(THREE, scene, renderer, { tone: 'loft' });
    const { box, floor: floorMat, wood: timber, metal, plaster } = building;
    box(16.4, .3, 16.4, 0, -.15, 0, floorMat);
    const brass = new THREE.MeshStandardMaterial({ color: 0xa58a58, roughness: .48, metalness: .55 });
    const linen = new THREE.MeshStandardMaterial({ color: 0xaaa48e, roughness: 1 });
    const rugCanvas = document.createElement('canvas'); rugCanvas.width = rugCanvas.height = 512;
    const rugCtx = rugCanvas.getContext('2d');
    rugCtx.fillStyle = '#858674'; rugCtx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 4) {
      rugCtx.strokeStyle = y % 8 ? '#92917f' : '#767968'; rugCtx.lineWidth = 1;
      rugCtx.beginPath(); rugCtx.moveTo(0, y); rugCtx.lineTo(512, y); rugCtx.stroke();
    }
    rugCtx.strokeStyle = '#626b60'; rugCtx.lineWidth = 6; rugCtx.strokeRect(16, 16, 480, 480);
    const rugMap = new THREE.CanvasTexture(rugCanvas); rugMap.colorSpace = THREE.SRGBColorSpace;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.1), new THREE.MeshStandardMaterial({ map: rugMap, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, .018, -1); scene.add(rug);
    // Low furnishings stay against the walls, outside the bench, easels and arrival route.
    box(1.15, .18, 3.1, -7.1, .18, 1.1, timber);
    box(1.12, .3, 3, -7.1, .42, 1.1, linen);
    box(.24, .65, 3, -7.56, .65, 1.1, linen);
    for (const z of [-.3, 2.5]) box(1.12, .38, .18, -7.1, .61, z, linen);
    const pillow = box(.5, .13, .55, -7.1, .65, .2, linen); pillow.rotation.y = .2;
    box(.4, .05, .4, -6.9, .04, -1.25, brass);
    box(.035, 2.2, .035, -6.9, 1.1, -1.25, brass);
    const readingShade = new THREE.Mesh(new THREE.ConeGeometry(.32, .35, 40, 1, true), linen);
    readingShade.position.set(-6.9, 2.23, -1.25); scene.add(readingShade);
    const readingLight = new THREE.PointLight(0xf4d3a1, 7, 5.5); readingLight.position.set(-6.9, 2.06, -1.25); scene.add(readingLight);
    for (const x of [-5.3, 5.3]) {
      box(3.1, .75, .08, x, .42, -7.65, timber);
      for (const sx of [-1.5, 1.5]) box(.08, .8, .56, x + sx, .42, -7.4, timber);
      for (const y of [.08, .44, .82]) box(3.1, .06, .56, x, y, -7.4, timber);
      for (let b = 0; b < 12; b++) box(.11 + b % 3 * .025, .24, .35, x - 1.3 + b * .23, .58, -7.4, b % 3 ? linen : building.paint);
    }
    const archiveBox = new THREE.MeshStandardMaterial({ color: 0x9a8c71, roughness: 1 });
    for (let i = 0; i < 3; i++) {
      const x = 7.2 - (i % 2) * .75, y = i === 2 ? .79 : .27;
      box(.7, .5, .65, x, y, -5.7, archiveBox);
      box(.74, .05, .69, x, y + .25, -5.7, linen);
      box(.17, .035, .015, x, y + .08, -5.36, metal);
    }
    box(.028, 2.1, .028, 0, 4.5, -1.4, brass);
    const pendant = new THREE.Mesh(new THREE.ConeGeometry(.55, .3, 48, 1, true), brass);
    pendant.position.set(0, 3.35, -1.4); scene.add(pendant);
    const pendantGlow = new THREE.Mesh(new THREE.CircleGeometry(.49, 48), new THREE.MeshBasicMaterial({ color: 0xf5dfb4, side: THREE.DoubleSide }));
    pendantGlow.rotation.x = Math.PI / 2; pendantGlow.position.set(0, 3.23, -1.4); scene.add(pendantGlow);

    // Plastered walls with wainscoting & exposed timber attic rafters
    building.wall(.35, 5.8, 16.4, -8.0, 0, 0);
    building.wall(.35, 5.8, 16.4, 8.0, 0, 0);
    building.wall(5.8, 5.8, .35, -5.1, 0, -8.0);
    building.wall(5.8, 5.8, .35, 5.1, 0, -8.0);
    box(4.6, 1.9, .35, 0, 4.85, -8.0, plaster);
    box(4.6, 1.1, .35, 0, .55, -8.0, building.paint);
    building.wall(6.4, 5.8, .35, -4.8, 0, 8.0);
    building.wall(6.4, 5.8, .35, 4.8, 0, 8.0);
    box(3.4, 1.8, .35, 0, 4.9, 8.0, plaster);
    box(16.4, .25, 16.4, 0, 5.8, 0, building.ceiling);
    for (const z of [-6, -2, 2, 6]) box(15.8, .28, .22, 0, 5.56, z, timber);

    // Her Draftsman Workbench + Floating Sovereign Architectural Maquette
    building.desk(0, 0, -1.4, 2.8, 1.4, 0.96, timber, metal);
    building.desk(4.2, 0, 3.4, 1.5, 1.0, 0.9, timber, metal);
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xcfc9b8, roughness: .95, side: THREE.DoubleSide });
    for (const [sx, sz, rot] of [[-.82, -1.3, .22], [-.55, -1.65, -.14], [.45, -1.15, .38]]) {
      const slip = box(.38, .015, .28, sx, .97, sz, paperMat);
      slip.rotation.y = rot;
    }

    // Living miniature maquette of the threshold rooms (visualizes her dominion)
    const maquette = new THREE.Group();
    maquette.position.set(0, 1.24, -1.4);
    const wireMat = new THREE.MeshStandardMaterial({ color: 0xd9d2be, emissive: 0x3b3526, roughness: .5 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb19763, roughness: .35, metalness: .65 });
    const mqBase = new THREE.Mesh(new THREE.CylinderGeometry(.38, .42, .05, 16), metal);
    mqBase.position.y = -.22;
    const mqRing = new THREE.Mesh(new THREE.TorusGeometry(.32, .012, 8, 28), brassMat);
    mqRing.rotation.x = Math.PI / 2;
    maquette.add(mqBase, mqRing);
    for (const [px, pz] of [[-.11, -.11], [.11, -.11], [-.11, .11], [.11, .11]]) {
      const tinyCol = new THREE.Mesh(new THREE.BoxGeometry(.045, .22, .045), wireMat);
      tinyCol.position.set(px, 0, pz);
      maquette.add(tinyCol);
    }
    const tinyBridge = new THREE.Mesh(new THREE.BoxGeometry(.08, .018, .22), brassMat);
    tinyBridge.position.set(0, .06, -.16);
    maquette.add(tinyBridge);
    scene.add(maquette);
    animatedObjects.push(dt => {
      if (!motion?.reduced?.()) {
        const t = performance.now() * 0.001;
        maquette.rotation.y += dt * (conversation ? .65 : .22);
        maquette.position.y = 1.24 + Math.sin(t * 1.4) * .025;
        mqRing.rotation.z += dt * .4;
        warmLamp.intensity += ((conversation ? 31 : 27) - warmLamp.intensity) * Math.min(1, dt * 2);
      }
    });

    void loadGLB('/assets/p34/models/paper-prism-lamp.glb').then(model => {
      if (disposed || version !== buildId || currentLayerId !== 'loft') return;
      model.position.set(0.95, 0.98, -1.4);
      model.scale.setScalar(0.75);
      scene.add(model);
    });

    // Drafting easels / lecterns holding layered parchment clues
    for (const x of [-4.4, 4.4]) {
      const easel = new THREE.Group();
      easel.position.set(x, 0, -2.2);
      easel.rotation.y = x < 0 ? 0.34 : -0.34;
      box(.07, 1.85, .07, -.42, .92, -.12, timber, easel).rotation.x = -.15;
      box(.07, 1.85, .07, .42, .92, -.12, timber, easel).rotation.x = -.15;
      box(1.15, .06, .16, 0, 1.0, .06, timber, easel);
      const sketchCanvas = document.createElement('canvas'); sketchCanvas.width = 768; sketchCanvas.height = 1024;
      const c = sketchCanvas.getContext('2d');
      c.fillStyle = '#ded8c4'; c.fillRect(0, 0, 768, 1024);
      c.strokeStyle = '#b5af9e'; c.lineWidth = 1;
      for (let i = 88; i < 960; i += 48) { c.beginPath(); c.moveTo(64, i); c.lineTo(704, i); c.stroke(); }
      c.strokeStyle = '#4d574f'; c.lineWidth = 3; c.lineJoin = 'round';
      const points = x < 0 ? [[112, 650], [244, 650], [322, 330], [438, 330], [516, 650], [650, 650]] : [[120, 670], [260, 500], [256, 300], [500, 300], [502, 500], [650, 670]];
      for (const offset of [0, 9]) {
        c.beginPath(); points.forEach(([px, py], i) => i ? c.lineTo(px + offset, py - offset) : c.moveTo(px + offset, py - offset)); c.stroke();
      }
      c.lineWidth = 2; c.strokeRect(126, 734, 204, 136); c.strokeRect(440, 735, 204, 136);
      c.beginPath(); c.moveTo(330, 802); c.lineTo(440, 802); c.lineTo(420, 790); c.moveTo(440, 802); c.lineTo(420, 814); c.stroke();
      c.fillStyle = '#545b51'; c.font = 'italic 46px serif'; c.fillText(x < 0 ? '34 /' : 'a / b', 86, 152);
      c.strokeStyle = '#a35947'; c.lineWidth = 4;
      c.beginPath(); c.ellipse(386, 342, 150, 80, -.1, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(540, 250); c.quadraticCurveTo(625, 212, 650, 295); c.lineTo(640, 280); c.moveTo(650, 295); c.lineTo(658, 276); c.stroke();
      c.beginPath(); c.moveTo(86, 914); c.lineTo(280, 900); c.moveTo(620, 860); c.lineTo(659, 891); c.lineTo(684, 831); c.stroke();
      c.font = 'italic 25px serif'; c.fillStyle = '#8d4c40'; c.fillText(x < 0 ? 'h + ?' : 'not the same hand', 460, 220);
      const sketchMap = new THREE.CanvasTexture(sketchCanvas); sketchMap.colorSpace = THREE.SRGBColorSpace;
      sketchMap.anisotropy = Math.min(4, renderer?.capabilities.getMaxAnisotropy() || 1);
      const sketchMat = new THREE.MeshStandardMaterial({ map: sketchMap, roughness: 1 });
      const sheet = box(.92, 1.18, .025, 0, 1.56, .04, paperMat, easel);
      sheet.rotation.x = -.14;
      const drawing = new THREE.Mesh(new THREE.PlaneGeometry(.92, 1.18), sketchMat);
      drawing.position.set(0, 1.56, .056); drawing.rotation.x = -.14; easel.add(drawing);
      const backSheet = box(.88, 1.12, .02, .06, 1.54, .01, building.plaster, easel);
      backSheet.rotation.set(-.14, 0, -.05);
      scene.add(easel);
      if (x < 0) {
        const spare = new THREE.Group(); spare.position.set(-7.55, .75, -3.8); spare.rotation.set(-.1, 1.3, 0);
        box(1.1, 1.4, .06, 0, 0, 0, timber, spare);
        const spareDrawing = new THREE.Mesh(new THREE.PlaneGeometry(.98, 1.28), sketchMat); spareDrawing.position.z = .035;
        spare.add(spareDrawing); scene.add(spare);
      }
    }

    // Real Rainy Night Window + Forever-Reversing Car in Distant Fog
    for (const fx of [-2.15, 0, 2.15]) box(.12, 3.3, .22, fx, 2.25, -7.85, timber);
    for (const fy of [1.05, 2.25, 3.85]) box(4.45, .1, .22, 0, fy, -7.85, timber);
    const rainCanvas = document.createElement('canvas'); rainCanvas.width = rainCanvas.height = 1024;
    const rc = rainCanvas.getContext('2d');
    for (let i = 0; i < 650; i++) {
      const rx = (i * 173.31) % 1024, ry = (i * 293.77) % 1024, rlen = 4 + (i % 19);
      rc.strokeStyle = `rgba(182,212,226,${.05 + (i % 5) * .025})`; rc.lineWidth = .45 + (i % 3) * .15;
      rc.beginPath(); rc.moveTo(rx, ry); rc.lineTo(rx - .7, ry + rlen); rc.stroke();
    }
    const rainTex = new THREE.CanvasTexture(rainCanvas);
    rainTex.colorSpace = THREE.SRGBColorSpace;
    rainTex.wrapS = rainTex.wrapT = THREE.RepeatWrapping;
    const glassPane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.75),
      new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: .65, depthWrite: false })
    );
    glassPane.position.set(0, 2.42, -7.82);
    scene.add(glassPane);
    const mistCanvas = document.createElement('canvas'); mistCanvas.width = mistCanvas.height = 512;
    const mc = mistCanvas.getContext('2d'), mist = mc.createRadialGradient(256, 240, 80, 256, 256, 340);
    mist.addColorStop(0, 'rgba(102,127,140,.01)'); mist.addColorStop(.65, 'rgba(84,105,115,.035)'); mist.addColorStop(1, 'rgba(76,96,106,.2)');
    mc.fillStyle = mist; mc.fillRect(0, 0, 512, 512);
    const mistMap = new THREE.CanvasTexture(mistCanvas); mistMap.colorSpace = THREE.SRGBColorSpace;
    const mistPane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.75), new THREE.MeshBasicMaterial({ map: mistMap, transparent: true, depthWrite: false }));
    mistPane.position.set(0, 2.42, -7.81); scene.add(mistPane);

    // Exterior rainy night abyss (-8.2..-20.6) with twin faint taillights reversing endlessly
    const nightMat = new THREE.MeshBasicMaterial({ color: 0x182026 });
    box(.1, 8, 12.4, -6, 2.5, -14.4, nightMat).castShadow = false;
    box(.1, 8, 12.4, 6, 2.5, -14.4, nightMat).castShadow = false;
    box(12, 8, .1, 0, 2.5, -20.5, nightMat).castShadow = false;
    box(12, .1, 12.4, 0, -.5, -14.4, new THREE.MeshBasicMaterial({ color: 0x1e2529 })).castShadow = false;
    box(.055, 3.8, .055, -2.3, 1.4, -15.8, metal);
    box(.65, .055, .055, -2, 3.3, -15.8, metal);
    box(.33, .07, .24, -1.8, 3.28, -15.8, new THREE.MeshBasicMaterial({ color: 0xe0b57a }));
    const reflectionCanvas = document.createElement('canvas'); reflectionCanvas.width = 128; reflectionCanvas.height = 512;
    const refl = reflectionCanvas.getContext('2d'), glow = refl.createRadialGradient(64, 256, 5, 64, 256, 240);
    glow.addColorStop(0, 'rgba(222,169,92,.23)'); glow.addColorStop(1, 'rgba(222,169,92,0)');
    refl.fillStyle = glow; refl.fillRect(0, 0, 128, 512);
    const reflection = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(reflectionCanvas), transparent: true, depthWrite: false }));
    reflection.rotation.x = -Math.PI / 2; reflection.position.set(-1.8, -.44, -14); scene.add(reflection);
    const carTailGroup = new THREE.Group();
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xd9564e, transparent: true, opacity: .75 });
    for (const tx of [-.45, .45]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), tailMat);
      lamp.position.x = tx;
      carTailGroup.add(lamp);
    }
    carTailGroup.position.set(-.6, 1.35, -12.8);
    scene.add(carTailGroup);
    let rainPhase = 0;
    animatedObjects.push(dt => {
      if (motion?.reduced?.()) return;
      rainPhase += dt;
      rainTex.offset.y += dt * .07;
      // Car slowly reverses farther into mist, stalls, and starts again
      const cycle = (rainPhase % 12) / 12;
      carTailGroup.position.z = -11.5 - cycle * 5.8;
      tailMat.opacity = cycle > .8 ? (1 - cycle) * 3.5 : .7;
    });

    // Return doorway vestibule to Stacks
    for (const x of [-1.7, 1.7]) box(.3, 4.0, .4, x, 2, 7.7, plaster);
    box(3.7, .3, .4, 0, 4, 7.7, plaster);
    building.deepPortal(0, 0, 7.75, 3.1, 3.5, Math.PI, 4, 0x1e2423);

    garden = addLoftGarden(THREE, scene, building);
    residents = addResidents(THREE, scene, config, () => player, motion.reduced, {
      layerId: 'loft',
      isDialogueOpen: () => Boolean(conversation),
    });
    animatedObjects.push(dt => residents.update(dt));
  }

  function rebuildLayerScene() {
    clearScene();
    state = getState();
    config = worldConfig();
    if (library) populateLibrary();
    else if (currentLayerId === 'atrium') populateAtrium();
    else if (currentLayerId === 'stacks') populateStacks();
    else populateLoft();
    audio.setLayer(library ? 'library' : currentLayerId);
    applyGardenPreferences();
    if (reading) frameReading();
    else syncCamera();
    updateTargetPrompt();
  }

  function applyGardenPreferences() {
    if (library) return;
    const sky = state.garden.sky || skyFromHour(new Date().getHours());
    const tone = state.garden.chime ?? 0;
    if (appliedSky !== sky) {
      appliedSky = sky;
      const mood = GARDEN_LIGHT[sky];
      if (gardenLighting) {
        const { hemi, dir, centerLight, skylight } = gardenLighting;
        hemi.color.setHex(mood.sky); hemi.groundColor.setHex(mood.ground);
        hemi.intensity = mood.hemi * (currentLayerId === 'stacks' ? .95 : 1);
        dir.color.setHex(mood.sun); dir.position.set(...mood.position);
        dir.intensity = mood.direct * (currentLayerId === 'stacks' ? .3 : 1);
        if (dir.castShadow) dir.shadow.needsUpdate = true;
        scene.fog.color.setHex(mood.fog);
        if (currentLayerId === 'stacks') scene.fog.color.multiplyScalar(.3);
        else { scene.fog.near = sky === 'midnight' ? 20 : 27; scene.fog.far = sky === 'midnight' ? 48 : 65; }
        scene.background.copy(scene.fog.color);
        if (centerLight) { centerLight.color.setHex(mood.glow); centerLight.intensity = mood.pool; skylight.material.color.setHex(mood.glow); }
      }
      garden?.setSky?.(sky); audio.setGardenSky(sky);
    }
    if (appliedChime !== tone) { appliedChime = tone; garden?.setChime?.(tone); }
  }

  function flashGardenEcho(reason) {
    if (gardenEchoes.has(reason) || motion.reduced()) return;
    if (residents.flashSovereign()) gardenEchoes.add(reason);
  }

  function syncCamera() {
    const moving = keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD') || (touchStick.analog && Math.hypot(touchStick.dx, touchStick.dy) > .12);
    const bob = !motion?.reduced?.() && moving ? Math.sin(bobPhase) * 0.045 : 0;
    camera.position.set(player.x, (player.y || 0) + EYE_HEIGHT + bob, player.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }

  function updateTargetPrompt() {
    if (reading) {
      promptBox.hidden = true;
      activeTarget = null;
      if (touchInteractBtn) { touchInteractBtn.dataset.active = 'false'; touchInteractBtn.textContent = '环视'; }
      return;
    }
    activeTarget = findInteractiveTarget(player, player.yaw, player.pitch, config.interactables);
    reticle.dataset.active = String(Boolean(activeTarget));
    if (activeTarget) {
      promptBox.hidden = false;
      promptTitle.textContent = activeTarget.label;
      promptBtn.textContent = activeTarget.prompt;
      promptBtn.hidden = Boolean(activeTarget.crossing);
      if (touchInteractBtn) {
        touchInteractBtn.dataset.active = activeTarget.crossing ? 'false' : 'true';
        touchInteractBtn.textContent = activeTarget.label;
      }
    } else {
      promptBox.hidden = true;
      if (touchInteractBtn) {
        touchInteractBtn.dataset.active = 'false';
        touchInteractBtn.textContent = '环视';
      }
    }
  }

  function openInspectorModal(title, renderContent, kind = '') {
    keys.clear(); draggingLook = false; lookPointerId = null;
    resetTouchStick();
    modal.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (kind) modalCard.dataset.modalKind = kind;
    else delete modalCard.dataset.modalKind;
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
    state = getState();

    if (target.kind === 'garden-sundial') {
      const sky = GARDEN_SKIES[(GARDEN_SKIES.indexOf(appliedSky) + 1) % GARDEN_SKIES.length];
      onInteract?.('garden-sky', sky); state = getState(); applyGardenPreferences();
      audio.playInteraction('pillar');
      if (sky === 'midnight') flashGardenEcho('midnight');
      return true;
    }
    if (target.kind === 'corridor-chimes') {
      const tone = ((state.garden.chime ?? -1) + 1) % 3;
      garden.pluck(); audio.playInteraction('chime', tone);
      onInteract?.('garden-chime', tone); state = getState(); applyGardenPreferences();
      return true;
    }
    if (target.kind === 'garden-specimen' || target.kind === 'loft-daily-note') {
      audio.playInteraction('paper');
      if (target.specimen === 'blank') { flashGardenEcho('blank'); onGardenComment?.(LINES.garden.blank); }
      const note = target.kind === 'loft-daily-note' ? dailyNote(state) : null;
      openInspectorModal(target.label, body => {
        const sheet = document.createElement('div'); sheet.className = 'world3d-clue-sheet';
        const label = document.createElement('span'); label.className = 'world3d-clue-side-label';
        label.textContent = note ? { morning: '清晨', afternoon: '午后', dusk: '傍晚', midnight: '深夜' }[note.sky] : { lamp: 'sayori.org · 桌边', folio: 'blog.sayori.org · 折页', blank: '第 34 号 · 署名处' }[target.specimen];
        sheet.append(label);
        for (const text of note ? note.lines : [LINES.garden.specimens[target.specimen]]) { const p = document.createElement('p'); p.textContent = text; sheet.append(p); }
        const actions = document.createElement('div'); actions.className = 'world3d-modal-actions';
        const back = document.createElement('button'); back.type = 'button'; back.textContent = '放回'; back.addEventListener('click', closeModal); actions.append(back);
        body.append(sheet, actions);
      }, 'clue');
      return true;
    }

    if (target.kind === 'talk-arrival') {
      residents.triggerArrivalDissolve(true);
      onInteract?.('talk-arrival', target);
      updateTargetPrompt();
      return true;
    }

    if (target.kind === 'book') { audio.playInteraction('book'); library.onRead(target.slug); return true; }
    if (target.kind === 'library-exit') { audio.playInteraction('portal'); onOpenRoom('home'); return true; }

    if (target.kind === 'seam') {
      audio.playInteraction('portal');
      onLeaveSite?.();
      return true;
    }

    if (target.kind === 'lab-link') {
      audio.playInteraction('paper');
      onInteract?.('lab-link', target);
      onOpenRoom?.('lab');
      return true;
    }

    if (target.kind === 'glb-lamp') {
      lampColorIdx = (lampColorIdx + 1) % LAMP_COLORS.length;
      if (lampLightRef) lampLightRef.color.setHex(LAMP_COLORS[lampColorIdx]);
      audio.playInteraction('lamp');
      onInteract?.('glb-lamp', target);
      return true;
    }

    if (target.kind === 'glb-fork') {
      audio.playInteraction('fork');
      onInteract?.('glb-fork', target);
      return true;
    }

    if (target.kind === 'terminal') {
      audio.playInteraction('terminal');
      onInteract?.('terminal', target);
      openInspectorModal('sayori.org // BACKSTAGE SHELL', body => {
        const logs = [
          `> layer: ${LAYER_LABELS[currentLayerId] || currentLayerId}`,
          `> discovered: ${state.layers.length} 层 · clues: ${state.clues.length} 份`,
          `> north_bridge: ${state.bridgeSolid ? 'solidified' : 'suspended (folded-sketch pending)'}`,
          '> owner_sig: [unclaimed / resident-sovereign]',
          '> note: 折页台与博客笔记里的草图仍在互相指向',
        ];
        const pre = document.createElement('div');
        pre.className = 'world3d-terminal-log';
        pre.innerHTML = logs.map(line => `<code>${line}</code>`).join('');
        const links = document.createElement('div');
        links.className = 'world3d-modal-actions';
        const mk = (label, fn) => {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = label;
          b.addEventListener('click', () => { closeModal(); fn(); });
          links.append(b);
        };
        mk('去折页台', () => onOpenRoom?.('lab'));
        mk('去笔记', () => onOpenRoom?.('blog'));
        mk('离开终端', () => viewport.focus({ preventScroll: true }));
        body.append(pre, links);
      }, 'terminal');
      return true;
    }

    if (target.kind === 'blog-desk') {
      audio.playInteraction('paper');
      onOpenRoom?.('blog');
      return true;
    }

    if (target.kind === 'projector') {
      if (state.diagram) {
        audio.playInteraction('unlock');
        onInteract?.('sync-pillars', target);
        state = getState();
        config = getLayerConfig(currentLayerId, state);
        rebuildLayerScene();
      } else {
        audio.playInteraction('terminal');
        onInteract?.('projector-hint', target);
      }
      return true;
    }

    if (target.kind === 'pillar') {
      const wasUnlocked = state.stacksUnlocked;
      onInteract?.('rotate-pillar', { pillar: target.pillar });
      state = getState();
      audio.playInteraction(!wasUnlocked && state.stacksUnlocked ? 'unlock' : 'pillar');
      config = getLayerConfig(currentLayerId, state);
      rebuildLayerScene();
      return true;
    }

    if (target.kind === 'portal') {
      const dest = target.targetLayer;
      if (dest === 'loft' && !state.stacksUnlocked && !state.layers.includes('loft')) {
        audio.playInteraction('pillar');
        onInteract?.('portal-locked-loft', target);
        return false;
      }
      audio.playInteraction('portal');
      switchLayer(dest);
      return true;
    }

    if (target.kind === 'clue') {
      const info = CLUE_INFO[target.clueId];
      audio.playInteraction('clue');
      onInteract?.('clue', target.clueId);
      state = getState();
      if (info) {
        const CLUE_BACKS = {
          'atrium-survey': '背面压着一道折痕：「西侧走过阶梯，东窗外不是原来的院子。」',
          'slot-34-log': '背面边缘有铅笔修改的刻度：房间标高一直在被挪动，但第 34 栏永远留白。',
          'dual-handwriting': '背面另一种稍快、稍斜的笔迹：「入口撤了，房间又没消失。——是我留着的。」',
          'rain-origin-trace': '录音底噪里混着倒车提示音，和博客《雨夹》里的窗沿完全重合。',
        };
        const backText = CLUE_BACKS[target.clueId];
        openInspectorModal(info.title, body => {
          let flipped = false;
          const sheet = document.createElement('div');
          sheet.className = 'world3d-clue-sheet';
          const renderSide = () => {
            sheet.innerHTML = `<span class="world3d-clue-side-label">${flipped ? '背面 · 附注' : '正面 · 残页'}</span><p>${flipped && backText ? backText : info.summary}</p>`;
          };
          renderSide();
          const links = document.createElement('div');
          links.className = 'world3d-modal-actions';
          links.innerHTML = `<button type="button" data-keep-exploring>放回</button>${backText ? '<button type="button" data-flip-clue>翻面</button>' : ''}<button type="button" data-view-archive>档案</button>`;
          links.querySelector('[data-keep-exploring]').addEventListener('click', closeModal);
          links.querySelector('[data-flip-clue]')?.addEventListener('click', () => {
            flipped = !flipped;
            audio.playInteraction('flip');
            renderSide();
          });
          links.querySelector('[data-view-archive]').addEventListener('click', () => {
            closeModal();
            onOpenRoom?.('archive');
          });
          body.append(sheet, links);
        }, 'clue');
      }
      return true;
    }

    if (target.kind === 'talk-bench') {
      audio.playInteraction('glyph');
      onInteract?.('talk-bench', target);
      return true;
    }

    if (target.kind === 'guestbook-link') {
      audio.playInteraction('paper');
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

  function stepSurfaceKind(x, z, y) {
    if (currentLayerId === 'atrium' && inPool(x, z, y)) return 'water';
    if ((currentLayerId === 'atrium' && z < -10.0 && y > 3.1) || (currentLayerId === 'stacks' && z < -7.4)) return 'bridge';
    if (library || currentLayerId === 'loft' || (currentLayerId === 'atrium' && x > 18 && y > 1.8)) return 'wood';
    return 'tile';
  }

  function stepMovement(dt, turnDt = dt) {
    if (keys.size || touchStick.analog) help.hidden = true;
    let forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    let strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    if (touchStick.analog) {
      forward += -touchStick.dy;
      strafe += touchStick.dx;
    }
    const turn = (keys.has('ArrowLeft') || keys.has('KeyQ') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('KeyR') ? 1 : 0);

    if (turn !== 0) {
      player.yaw += turn * turnDt * 1.12;
    }

    const mag = Math.hypot(forward, strafe);
    if (mag > 0.08) {
      const clampMag = Math.min(1, mag);
      const nf = forward / mag;
      const ns = strafe / mag;
      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || (touchStick.analog && mag > 0.85);
      const speed = (sprinting ? 6.8 : 4.9) * (touchStick.analog ? clampMag : 1);
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
      if (door) { keys.clear(); resetTouchStick(); triggerInteraction(door); return true; }
      if (moved > 0.001) {
        bobPhase += moved * 3.6;
        stepDistance += moved;
        if (stepDistance >= 2.05) {
          stepDistance = 0;
          audio.playFootstep(stepSurfaceKind(player.x, player.z, player.y), sprinting);
          if (currentLayerId === 'atrium') garden.ripple(player.x, player.z);
        }
      }
    }
    syncCamera();
    updateTargetPrompt();
    return false;
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
  listen(promptBox, 'click', e => {
    e.stopPropagation();
    if (activeTarget && !activeTarget.crossing) triggerInteraction(activeTarget);
  });

  listen(viewport, 'pointerdown', e => {
    if (reading || !modal.hidden || pointerLocked || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (lookPointerId !== null) return;
    lookPointerId = e.pointerId;
    lookPointerType = e.pointerType || 'mouse';
    lookMoved = 0;
    draggingLook = true;
    lastPointer = { x: e.clientX, y: e.clientY };
  });
  listen(window, 'pointerup', e => {
    if (e.pointerId === lookPointerId) {
      if (lookPointerType === 'touch' && lookMoved < 8 && activeTarget && !activeTarget.crossing && !shellBlocked() && modal.hidden && !reading) {
        triggerInteraction(activeTarget);
      }
      draggingLook = false;
      lookPointerId = null;
    }
  });
  listen(window, 'pointercancel', e => {
    if (e.pointerId === lookPointerId) { draggingLook = false; lookPointerId = null; }
  });
  listen(window, 'pointermove', e => {
    if (pointerLocked) {
      player.yaw -= (e.movementX || 0) * 0.0024;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - (e.movementY || 0) * 0.0022));
      syncCamera();
      updateTargetPrompt();
    } else if (draggingLook && e.pointerId === lookPointerId) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lookMoved += Math.hypot(dx, dy);
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

  if (touchMovePad) {
    listen(touchMovePad, 'pointerdown', e => {
      if (touchStick.pointerId !== null) return;
      e.preventDefault();
      const stepBtn = e.target.closest?.('[data-step]');
      const stepCode = stepBtn ? { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' }[stepBtn.dataset.step] : null;
      touchStick.pointerId = e.pointerId;
      touchStick.originX = e.clientX;
      touchStick.originY = e.clientY;
      touchStick.dx = 0; touchStick.dy = 0; touchStick.analog = false;
      touchStick.stepCode = stepCode;
      if (stepCode) keys.add(stepCode);
      touchMovePad.setPointerCapture?.(e.pointerId);
    });
    listen(touchMovePad, 'pointermove', e => {
      if (e.pointerId !== touchStick.pointerId) return;
      const rawX = e.clientX - touchStick.originX;
      const rawY = e.clientY - touchStick.originY;
      const dist = Math.hypot(rawX, rawY);
      if (dist > 8) {
        if (touchStick.stepCode) { keys.delete(touchStick.stepCode); touchStick.stepCode = null; }
        touchStick.analog = true;
        touchMovePad.dataset.stickActive = 'true';
        const maxR = 42;
        const clamped = Math.min(maxR, dist);
        const angle = Math.atan2(rawY, rawX);
        touchStick.dx = (Math.cos(angle) * clamped) / maxR;
        touchStick.dy = (Math.sin(angle) * clamped) / maxR;
        if (stickNub) stickNub.style.transform = `translate3d(${(Math.cos(angle) * clamped).toFixed(1)}px, ${(Math.sin(angle) * clamped).toFixed(1)}px, 0)`;
      }
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(touchMovePad, ev, e => { if (e.pointerId === touchStick.pointerId) resetTouchStick(); });
    }
  }

  root.querySelectorAll('[data-step]').forEach(btn => {
    listen(btn, 'click', e => { if (e.detail === 0) nudgeMove(btn.dataset.step); });
  });
  root.querySelectorAll('[data-turn]').forEach(btn => {
    const code = btn.dataset.turn === 'left' ? 'ArrowLeft' : 'ArrowRight';
    listen(btn, 'pointerdown', e => {
      e.preventDefault(); keys.add(code);
      btn.setPointerCapture?.(e.pointerId);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(btn, event, () => keys.delete(code));
  });
  listen(touchInteractBtn, 'click', () => {
    if (activeTarget && !activeTarget.crossing) triggerInteraction(activeTarget);
  });

  function shellBlocked() {
    const shell = root.closest('#p34-space');
    return shell.dataset.map === 'true' || shell.dataset.talking === 'true';
  }

  listen(window, 'blur', () => { keys.clear(); draggingLook = false; lookPointerId = null; resetTouchStick(); });
  listen(document, 'visibilitychange', () => setActive(!document.hidden && root.closest('#p34-space').dataset.room === (library ? 'blog' : 'home')));

  function animate(now) {
    if (signal?.aborted || !active || disposed) return;
    const rawDt = Math.min(0.072, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    preferenceTimer += rawDt;
    if (preferenceTimer > 1) { preferenceTimer = 0; state = getState(); applyGardenPreferences(); }
    residents?.updateEcho();
    if (!reading && modal.hidden && !shellBlocked()) {
      const steps = rawDt > 0.045 ? 2 : 1;
      const subDt = rawDt / steps;
      const turnStep = Math.min(0.048, rawDt) / steps;
      for (let i = 0; i < steps; i++) {
        if (stepMovement(subDt, turnStep)) break;
        for (const fn of animatedObjects) fn(subDt);
      }
      audio.updateSpatial(player, library ? 'library' : currentLayerId, residents?.snapshot(), rawDt);
    }
    if (renderer) renderer.render(scene, camera);
    if (reading) pageRenderer.render(pages, camera);
    if (renderer && typography) {
      renderer.clearDepth(); renderer.autoClear = false;
      typography.render(renderer, rawDt);
      renderer.autoClear = true;
    }
    rafId = requestAnimationFrame(animate);
  }

  updateSize();
  rebuildLayerScene();
  rafId = requestAnimationFrame(animate);

  function setActive(value) {
    active = value && !disposed;
    keys.clear(); draggingLook = false; lookPointerId = null; resetTouchStick();
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
    getResidents: () => residents?.snapshot() || null,
    getGarden: () => ({ sky: appliedSky, chime: appliedChime, ...(garden?.snapshot?.() || {}) }),
    ringChime(tone) { garden.pluck(); audio.playInteraction('chime', tone); state = getState(); applyGardenPreferences(); },
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
