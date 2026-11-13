import { lightPoint, INITIAL_LIGHT } from './p34-light.js?v=20261113-3d';
import {
  LAYERS,
  LAYER_LABELS,
  PILLAR_OPTIONS,
  TARGET_PILLARS,
  CLUE_INFO,
  pillarsAligned,
} from './p34-journey.js?v=20261113-3d';

const PLAYER_RADIUS = 0.42;
const EYE_HEIGHT = 1.65;

export function getLayerConfig(layer, state = {}) {
  if (layer === 'atrium') {
    const westAligned = Boolean(state.westAligned);
    const bridgeSolid = Boolean(state.bridgeSolid);
    return {
      id: 'atrium',
      title: LAYER_LABELS.atrium,
      subtitle: '视口背面的折光中庭 · 观察西廊取景框或凝结实验室光桥以登上二层天桥',
      spawn: { x: 0, y: 0, z: 8.8, yaw: 0, pitch: 0 },
      bounds: { minX: -13.2, maxX: 13.2, minZ: -18.2, maxZ: 12.2 },
      surfaces: [
        // Main floor
        { id: 'main-floor', minX: -13.5, maxX: 13.5, minZ: -12.5, maxZ: 12.5, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
        // West staircase (Z: -2.0 -> -6.8 rises Y: 0 -> 3.2)
        { id: 'west-stairs', minX: -11.4, maxX: -7.4, minZ: -6.8, maxZ: -1.8, yStart: 0, yEnd: 3.2, axis: '-z', enabled: westAligned },
        // Upper mezzanine balcony (Z: -10.5 -> -6.6 at Y = 3.2)
        { id: 'mezzanine', minX: -11.4, maxX: 7.5, minZ: -10.6, maxZ: -6.6, yStart: 3.2, yEnd: 3.2, axis: 'flat', enabled: westAligned || bridgeSolid },
        // Dynamic 3D Light Bridge (Z: -10.2 -> -14.2 rises Y: 3.2 -> 3.6)
        { id: 'light-bridge', minX: -2.4, maxX: 2.4, minZ: -14.4, maxZ: -10.0, yStart: 3.2, yEnd: 3.6, axis: '-z', enabled: bridgeSolid },
        // High Observation Platform (Z: -18.2 -> -14.0 at Y = 3.6)
        { id: 'high-platform', minX: -4.6, maxX: 4.6, minZ: -18.2, maxZ: -14.0, yStart: 3.6, yEnd: 3.6, axis: 'flat', enabled: bridgeSolid },
      ],
      colliders: [
        // Central courtyard pillars
        { id: 'col-nw', minX: -4.6, maxX: -3.4, minZ: -4.6, maxZ: -3.4, minY: 0, maxY: 6, enabled: true },
        { id: 'col-ne', minX: 3.4, maxX: 4.6, minZ: -4.6, maxZ: -3.4, minY: 0, maxY: 6, enabled: true },
        { id: 'col-sw', minX: -4.6, maxX: -3.4, minZ: 3.4, maxZ: 4.6, minY: 0, maxY: 6, enabled: true },
        { id: 'col-se', minX: 3.4, maxX: 4.6, minZ: 3.4, maxZ: 4.6, minY: 0, maxY: 6, enabled: true },
        // West gallery divider wall
        { id: 'west-divider', minX: -7.4, maxX: -6.6, minZ: -6.2, maxZ: -0.5, minY: 0, maxY: 4.5, enabled: true },
        // East alcove pedestal table
        { id: 'east-table', minX: 8.6, maxX: 10.2, minZ: -2.8, maxZ: 2.8, minY: 0, maxY: 1.5, enabled: true },
        // North chasm blocker when light bridge is not solid (blocks walking north past Z = -10.4)
        { id: 'chasm-guard', minX: -13.5, maxX: 13.5, minZ: -18.5, maxZ: -10.4, minY: 0, maxY: 5.0, enabled: !bridgeSolid },
      ],
      interactables: [
        {
          id: 'viewport-seam',
          label: '网页视口背面 · 接缝门',
          prompt: '按 E 或点击：查看视口接缝 / 返回正常网页',
          x: 0, y: 1.6, z: 11.4,
          kind: 'seam',
        },
        {
          id: 'light-sculpture-rig',
          label: '中庭立体光带 · 调谐端',
          prompt: bridgeSolid
            ? '按 E 或点击：光桥已凝实（可再次打开 2D 实验室改形状）'
            : '按 E 或点击：打开 2D《拉住一束光》把光拱起搭桥',
          x: 0, y: 1.4, z: 1.2,
          kind: 'lab-link',
        },
        {
          id: 'west-sightline-frame',
          label: '西廊视线取景框',
          prompt: westAligned
            ? '按 E 或点击：视线已校准，通往二层的折纸阶梯已展开'
            : '按 E 或点击：校准取景框视线，解开错位循环并展开二层阶梯',
          x: -6.5, y: 1.5, z: 1.5,
          kind: 'sightline',
        },
        {
          id: 'east-prism-lamp',
          label: '她的折纸棱镜灯 (GLB 模型)',
          prompt: '按 E 或点击：拨动折纸棱镜灯，切换回廊折射光色',
          x: 8.8, y: 1.4, z: -1.8,
          kind: 'glb-lamp',
        },
        {
          id: 'east-tuning-fork',
          label: '空间谐振音叉 (GLB 模型)',
          prompt: '按 E 或点击：敲击空间谐振音叉，聆听页背声场',
          x: 8.8, y: 1.4, z: 1.8,
          kind: 'glb-fork',
        },
        {
          id: 'east-web-terminal',
          label: '页背终端机 · sayori.org // BACKSTAGE',
          prompt: '按 E 或点击：操作真实网页终端与跨站博客连接',
          x: 11.2, y: 1.5, z: 0,
          kind: 'terminal',
        },
        {
          id: 'portal-to-stacks',
          label: '层间折门 → 第二层「索引外书库」',
          prompt: westAligned || bridgeSolid
            ? '按 E 或点击：穿过折门，前往「第二层 · 索引外书库」'
            : '（位于二层天桥：请先在西廊校准视线阶梯，或在实验室拉起光桥）',
          x: 0, y: 4.6, z: -9.6,
          kind: 'portal',
          targetLayer: 'stacks',
        },
        {
          id: 'high-platform-survey',
          label: '高处观测台 · 页背测绘仪',
          prompt: '按 E 或点击：读取《页背测绘记录》（穿过 3D 光桥抵达）',
          x: 0, y: 4.9, z: -16.2,
          kind: 'clue',
          clueId: 'atrium-survey',
        },
      ],
    };
  }

  if (layer === 'stacks') {
    const unlocked = Boolean(state.stacksUnlocked);
    const p = state.pillars || { west: 'void', center: 'ground', east: 'noise' };
    const labelFor = (pillar, id) => PILLAR_OPTIONS[pillar].find(o => o.id === id)?.label || id;
    return {
      id: 'stacks',
      title: LAYER_LABELS.stacks,
      subtitle: '沉没草稿的垂直书库 · 结合她的 2D 博客草图校准三座空间基准柱',
      spawn: { x: 0, y: 0, z: 8.8, yaw: 0, pitch: 0 },
      bounds: { minX: -11.5, maxX: 11.5, minZ: -13.5, maxZ: 11.5 },
      surfaces: [
        { id: 'stacks-floor', minX: -12.0, maxX: 12.0, minZ: -7.5, maxZ: 12.0, yStart: 0, yEnd: 0, axis: 'flat', enabled: true },
        { id: 'north-bridge', minX: -2.5, maxX: 2.5, minZ: -13.8, maxZ: -7.2, yStart: 0, yEnd: 0.6, axis: '-z', enabled: unlocked },
      ],
      colliders: [
        { id: 'north-void-guard', minX: -12.0, maxX: 12.0, minZ: -14.0, maxZ: -7.4, minY: 0, maxY: 5.0, enabled: !unlocked },
        { id: 'west-stack-wall', minX: -10.8, maxX: -9.2, minZ: -6.0, maxZ: 6.0, minY: 0, maxY: 8.0, enabled: true },
        { id: 'east-stack-wall', minX: 9.2, maxX: 10.8, minZ: -6.0, maxZ: 6.0, minY: 0, maxY: 8.0, enabled: true },
      ],
      interactables: [
        {
          id: 'portal-back-atrium',
          label: '层间折门 → 返回「第一层 · 页背回廊」',
          prompt: '按 E 或点击：返回「第一层 · 页背回廊」',
          x: 0, y: 1.6, z: 10.8,
          kind: 'portal',
          targetLayer: 'atrium',
        },
        {
          id: 'blog-reading-desk',
          label: '跨站阅览台 · 她的 2D 博客与《走廊拐弯的时候》',
          prompt: '按 E 或点击：查阅博客草图 / 前往 2D 博客页校准折线',
          x: -7.2, y: 1.4, z: 0.8,
          kind: 'blog-desk',
        },
        {
          id: 'east-relic-cabinet',
          label: '封存的旧实验陈列柜',
          prompt: '按 E 或点击：查看她收进玻璃柜的旧弹球架与批注',
          x: 7.2, y: 1.5, z: 0.8,
          kind: 'clue',
          clueId: 'retired-relic',
        },
        {
          id: 'blog-projector',
          label: '跨站草图投影仪 (2D 博客 ⇄ 3D 书库联动)',
          prompt: state.diagram
            ? '按 E 或点击：已接收 2D 博客草图信号！点击一键同步三座基准柱'
            : '按 E 或点击：查看投影仪状态（可前往 2D 博客拉直草图或手动旋转三柱）',
          x: 0, y: 1.3, z: -0.8,
          kind: 'projector',
        },
        {
          id: 'pillar-west',
          label: `西基准柱 · 视口折向 [${labelFor('west', p.west)}]`,
          prompt: '按 E 或点击：旋转西基准柱（目标提示见博客草图）',
          x: -4.2, y: 1.6, z: -4.2,
          kind: 'pillar',
          pillar: 'west',
        },
        {
          id: 'pillar-center',
          label: `中基准柱 · 楼层标高 [${labelFor('center', p.center)}]`,
          prompt: '按 E 或点击：升降中基准柱（目标提示见博客草图）',
          x: 0, y: 1.6, z: -5.2,
          kind: 'pillar',
          pillar: 'center',
        },
        {
          id: 'pillar-east',
          label: `东基准柱 · 留存声轨 [${labelFor('east', p.east)}]`,
          prompt: '按 E 或点击：切换东基准柱声轨（目标提示见《雨录进来了》）',
          x: 4.2, y: 1.6, z: -4.2,
          kind: 'pillar',
          pillar: 'east',
        },
        {
          id: 'portal-to-loft',
          label: '北面折页门 → 第三层「她的阁楼」',
          prompt: unlocked
            ? '按 E 或点击：穿过凝实的索引桥，进入「第三层 · 她的阁楼」'
            : '（虚线桥尚未凝实：请先将西、中、东三座基准柱对准博客草图记载的相位）',
          x: 0, y: 2.1, z: -11.6,
          kind: 'portal',
          targetLayer: 'loft',
        },
      ],
    };
  }

  // Layer 3: loft
  return {
    id: 'loft',
    title: LAYER_LABELS.loft,
    subtitle: '悬在雨声与夜色里的私密工作间 · 调查三处异常证据，认识真正的她',
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
        label: '层间折门 → 返回「第二层 · 索引外书库」',
        prompt: '按 E 或点击：返回「第二层 · 索引外书库」',
        x: 0, y: 1.6, z: 7.4,
        kind: 'portal',
        targetLayer: 'stacks',
      },
      {
        id: 'her-workbench',
        label: '她的立体沙盘工作台 · 与她交谈',
        prompt: '按 E 或点击：观察她的三层世界模型并与她聊聊',
        x: 0, y: 1.4, z: -1.4,
        kind: 'talk-bench',
      },
      {
        id: 'clue-slot-34',
        label: '异常证据 I · 《第34号目录的构建终端》',
        prompt: '按 E 或点击：调查 #34 目录早于建站时间的异常进程记录',
        x: -4.4, y: 1.5, z: -2.2,
        kind: 'clue',
        clueId: 'slot-34-log',
      },
      {
        id: 'clue-dual-handwriting',
        label: '异常证据 II · 《正反双笔迹批注稿》',
        prompt: '按 E 或点击：对照站长清理计划与她在页背留下的荧光批注',
        x: 4.4, y: 1.5, z: -2.2,
        kind: 'clue',
        clueId: 'dual-handwriting',
      },
      {
        id: 'clue-rain-window',
        label: '异常证据 III · 《雨夜窗沿与合成声纹仪》',
        prompt: '按 E 或点击：聆听窗外倒车的雨声，分析她的声纹起源',
        x: 0, y: 1.6, z: -6.8,
        kind: 'clue',
        clueId: 'rain-origin-trace',
      },
      {
        id: 'loft-guestbook-desk',
        label: '阁楼留言簿 · 公开留言板',
        prompt: '按 E 或点击：打开公开留言板，给她和其他探索者留句话',
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

export function resolvePlayerMovement(pos, nextX, nextZ, config, state = {}) {
  const { bounds, colliders, surfaces } = config;
  const clampX = x => Math.max(bounds.minX + PLAYER_RADIUS, Math.min(bounds.maxX - PLAYER_RADIUS, x));
  const clampZ = z => Math.max(bounds.minZ + PLAYER_RADIUS, Math.min(bounds.maxZ - PLAYER_RADIUS, z));

  let x = pos.x;
  let z = pos.z;
  let y = pos.y || 0;

  const candX = clampX(nextX);
  const candZ = clampZ(nextZ);

  // Non-Euclidean loop check in West Gallery of Atrium when westAligned is false!
  if (
    config.id === 'atrium' &&
    !state.westAligned &&
    candX < -7.4 &&
    candZ < -5.2
  ) {
    return {
      x: candX,
      y: 0,
      z: 4.8,
      looped: true,
    };
  }

  // Try X movement
  const yAtX = computeFloorElevation(candX, z, y, surfaces);
  if (!hitsCollider(candX, z, yAtX, colliders)) {
    x = candX;
    y = yAtX;
  }
  // Try Z movement
  const yAtZ = computeFloorElevation(x, candZ, y, surfaces);
  if (!hitsCollider(x, candZ, yAtZ, colliders)) {
    z = candZ;
    y = yAtZ;
  }

  return { x, y, z, looped: false };
}

export function checkSightlineAlignment(pos, yaw) {
  const inCircle = Math.hypot(pos.x - -6.5, pos.z - 1.5) <= 2.6;
  // Looking generally West/North-West (yaw between 0.25 and 2.35 rad, or normalized)
  const normYaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  const lookingWest = normYaw >= 0.15 && normYaw <= 2.45;
  return inCircle && lookingWest;
}

export function findInteractiveTarget(pos, yaw, pitch, interactables = [], maxDist = 4.8) {
  const lookX = -Math.sin(yaw) * Math.cos(pitch);
  const lookY = Math.sin(pitch);
  const lookZ = -Math.cos(yaw) * Math.cos(pitch);
  const eyeY = (pos.y || 0) + EYE_HEIGHT;

  let best = null;
  let bestScore = Infinity;

  for (const item of interactables) {
    const dx = item.x - pos.x;
    const dy = (item.y ?? 1.4) - eyeY;
    const dz = item.z - pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > maxDist) continue;
    const inv = 1 / (dist || 0.001);
    const dot = (dx * lookX + dy * lookY + dz * lookZ) * inv;
    // Allow close proximity or looking within ~52 deg cone
    if (dot < 0.42 && dist > 2.1) continue;
    const score = dist * (1.35 - Math.max(0, dot) * 0.65);
    if (score < bestScore) {
      bestScore = score;
      best = { ...item, distance: dist };
    }
  }
  return best;
}

function makeTextPanelTexture(THREE, { title, lines = [], accent = '#6be6ff', bg = '#0d1b32' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 492, 300);
    ctx.fillStyle = accent;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(title, 28, 54);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '20px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, 28, 104 + i * 36);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export async function mountWorld3D(container, {
  getState,
  getLightNodes,
  motion,
  onInteract,
  onLayerChange,
  onLoopWalked,
  onSightlineAligned,
  onShelfMoved,
  onOpenRoom,
  onLeaveSite,
  signal,
}) {
  const THREE = await import('./third-party/three/three.module.min.js');
  const { GLTFLoader } = await import('./third-party/three/GLTFLoader.js');
  if (signal?.aborted) return () => {};

  const root = document.createElement('div');
  root.className = 'world3d-stage';
  root.innerHTML = `
    <div class="world3d-viewport" data-viewport tabindex="0" role="application" aria-label="三维页背探索空间，使用 WASD 移动，鼠标或方向键转动视角，E 或点击交互"></div>
    <div class="world3d-reticle" data-reticle aria-hidden="true"><span></span></div>
    <header class="world3d-hud-top">
      <div class="world3d-layer-badge">
        <span class="world3d-layer-kicker">PAGE BACKSTAGE // 3D LAYER</span>
        <strong data-layer-title></strong>
        <p data-layer-subtitle></p>
      </div>
      <div class="world3d-quick-actions" role="toolbar" aria-label="层级与视角快捷操作">
        <button type="button" data-lock-btn class="world3d-chip">鼠标视角 (Click)</button>
        <button type="button" data-inspector-btn class="world3d-chip">空间终端 / 地图</button>
      </div>
    </header>
    <div class="world3d-prompt" data-prompt hidden aria-live="polite">
      <span class="world3d-prompt-title" data-prompt-title></span>
      <button type="button" class="world3d-prompt-action" data-prompt-btn></button>
    </div>
    <div class="world3d-compass" data-compass aria-label="当前位置与热点数"></div>
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
          <button type="button" data-turn="left" aria-label="向左看">↺ 左看</button>
          <button type="button" data-turn="right" aria-label="向右看">右看 ↻</button>
        </div>
        <button type="button" class="world3d-touch-interact" data-touch-interact>交互 (E)</button>
      </div>
    </div>
    <aside class="world3d-modal" data-modal hidden role="dialog" aria-modal="true" aria-labelledby="world3d-modal-title">
      <div class="world3d-modal-card">
        <header class="world3d-modal-header">
          <h2 id="world3d-modal-title" data-modal-title></h2>
          <button type="button" data-modal-close aria-label="关闭窗口">关闭 (Esc)</button>
        </header>
        <div class="world3d-modal-body" data-modal-body></div>
      </div>
    </aside>
  `;
  container.replaceChildren(root);

  const viewport = root.querySelector('[data-viewport]');
  const reticle = root.querySelector('[data-reticle]');
  const layerTitleEl = root.querySelector('[data-layer-title]');
  const layerSubtitleEl = root.querySelector('[data-layer-subtitle]');
  const promptBox = root.querySelector('[data-prompt]');
  const promptTitle = root.querySelector('[data-prompt-title]');
  const promptBtn = root.querySelector('[data-prompt-btn]');
  const compassEl = root.querySelector('[data-compass]');
  const lockBtn = root.querySelector('[data-lock-btn]');
  const inspectorBtn = root.querySelector('[data-inspector-btn]');
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
    console.warn('WebGLRenderer unavailable, enabling spatial DOM fallback view', err);
    const fallback = document.createElement('div');
    fallback.className = 'world3d-webgl-fallback';
    fallback.textContent = '当前环境未启用 WebGL 硬件渲染，已为您切换为可交互的空间测绘视图。';
    viewport.append(fallback);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 90);
  camera.rotation.order = 'YXZ';

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
  let currentLayerId = LAYERS.includes(state.currentLayer) ? state.currentLayer : 'atrium';
  let config = getLayerConfig(currentLayerId, state);
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
  let dynamicLightTube = null;
  let dynamicWestStairsGroup = null;
  let dynamicNorthBridgeGroup = null;
  let dynamicSlidingShelf = null;
  let pillarMeshes = {};
  let lampLightRef = null;
  let rafId = 0;
  let lastTime = performance.now();

  function updateSize() {
    const rect = viewport.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(w, h, false);
  }

  function clearScene() {
    animatedObjects = [];
    dynamicLightTube = null;
    dynamicWestStairsGroup = null;
    dynamicNorthBridgeGroup = null;
    dynamicSlidingShelf = null;
    pillarMeshes = {};
    lampLightRef = null;
    while (scene.children.length > 0) {
      const obj = scene.children[0];
      scene.remove(obj);
    }
  }

  function buildLightCurveMesh(nodes) {
    const pts = [];
    const safeNodes = Array.isArray(nodes) && nodes.length === 4 ? nodes : INITIAL_LIGHT;
    const solid = Boolean(state.bridgeSolid);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const [nx, ny] = lightPoint(safeNodes, t);
      if (solid) {
        // Forms an arched walkable light bridge from Mezzanine (Z=-10, Y=3.2) to High Platform (Z=-14.2, Y=3.6)
        const bx = (nx - 0.5) * 2.2;
        const bz = -10.0 - t * 4.4;
        const by = 3.2 + t * 0.4 + Math.sin(t * Math.PI) * Math.max(0.15, (0.55 - ny) * 0.6);
        pts.push(new THREE.Vector3(bx, by, bz));
      } else {
        // Floats across the central courtyard
        const cx = (nx - 0.5) * 9.0;
        const cy = 1.2 + (1 - ny) * 3.4;
        const cz = 2.0 - t * 8.5;
        pts.push(new THREE.Vector3(cx, cy, cz));
      }
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, 48, solid ? 0.55 : 0.14, 12, false);
    const mat = new THREE.MeshStandardMaterial({
      color: solid ? 0x9cf6ff : 0x73dcff,
      emissive: solid ? 0x2e8ab8 : 0x1b5c85,
      emissiveIntensity: solid ? 1.15 : 0.8,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: solid ? 0.92 : 0.78,
    });
    return new THREE.Mesh(geom, mat);
  }

  function populateAtrium() {
    scene.background = new THREE.Color(0x0f1e38);
    scene.fog = new THREE.FogExp2(0x0f1e38, 0.025);

    const hemi = new THREE.HemisphereLight(0x9ee4ff, 0x162644, 0.95);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xe4f7ff, 1.15);
    dir.position.set(10, 22, 12);
    scene.add(dir);

    const centerLight = new THREE.PointLight(0x5ee6ff, 2.2, 22);
    centerLight.position.set(0, 4.2, 0);
    scene.add(centerLight);

    const westLight = new THREE.PointLight(0xf5c476, 1.8, 16);
    westLight.position.set(-9.2, 3.2, 0);
    scene.add(westLight);

    const eastLight = new THREE.PointLight(LAMP_COLORS[lampColorIdx], 2.0, 16);
    eastLight.position.set(9.2, 3.2, -1.5);
    scene.add(eastLight);
    lampLightRef = eastLight;

    // Floor & Grid
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x162b4d, roughness: 0.35, metalness: 0.15 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 26), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(26, 26, 0x4ba8d8, 0x23436e);
    grid.position.y = 0.02;
    scene.add(grid);

    // Outer perimeter architectural walls with luminous trim
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e3863, roughness: 0.5, metalness: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8deeff, emissive: 0x2b7ea8, roughness: 0.2 });

    // South wall + Viewport Seam
    const southLeft = new THREE.Mesh(new THREE.BoxGeometry(10, 6.5, 0.5), wallMat);
    southLeft.position.set(-8.5, 3.25, 12.5);
    const southRight = new THREE.Mesh(new THREE.BoxGeometry(10, 6.5, 0.5), wallMat);
    southRight.position.set(8.5, 3.25, 12.5);
    scene.add(southLeft, southRight);

    const seamTex = makeTextPanelTexture(THREE, {
      title: 'sayori.org // VIEWPORT SEAM',
      lines: [
        '<!doctype html> <html class="p34-spatial">',
        '你正站在个人主页视口的背面',
        '正常访客在正面浏览，而你掀开了纸角 (?paper=0617)',
        '[E / 点击] 可随时穿回正常网页',
      ],
      accent: '#7eeeff',
      bg: '#13294b',
    });
    const seamMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 3.6),
      new THREE.MeshBasicMaterial({ map: seamTex, side: THREE.DoubleSide })
    );
    seamMesh.position.set(0, 2.1, 12.1);
    seamMesh.rotation.y = Math.PI;
    scene.add(seamMesh);

    // Four central chamfered monolith columns
    const colGeom = new THREE.BoxGeometry(1.1, 6.8, 1.1);
    const colMat = new THREE.MeshStandardMaterial({ color: 0xdbeeff, roughness: 0.3, metalness: 0.1 });
    for (const [cx, cz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const col = new THREE.Mesh(colGeom, colMat);
      col.position.set(cx, 3.4, cz);
      const ring = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.16, 1.22), trimMat);
      ring.position.set(cx, 2.2, cz);
      scene.add(col, ring);
    }

    // West Wing: Sightline Aperture Frame & Split Mural
    const vantageRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.15, 32),
      new THREE.MeshBasicMaterial({ color: 0xf6c978, side: THREE.DoubleSide })
    );
    vantageRing.rotation.x = -Math.PI / 2;
    vantageRing.position.set(-6.5, 0.04, 1.5);
    scene.add(vantageRing);

    const apertureFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.4, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf6c978, emissive: 0x6a4b18, wireframe: true })
    );
    apertureFrame.position.set(-8.2, 1.6, 0.4);
    scene.add(apertureFrame);

    const westWallTex = makeTextPanelTexture(THREE, {
      title: state.westAligned ? '西廊刻度：视线已对齐' : '西廊刻度：空间未闭环',
      lines: state.westAligned
        ? ['两截折线已在取景框内重合', '通往二层天桥的阶梯已展开', '沿着北侧阶梯即可登上二层']
        : ['警告：直接向北走会陷入回廊循环', '解法：退到地面的金色圆圈内', '面向西侧取景框按 [E] 对齐断线'],
      accent: state.westAligned ? '#7ef7c8' : '#f6c978',
      bg: '#1b2742',
    });
    const westWallBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.4),
      new THREE.MeshBasicMaterial({ map: westWallTex })
    );
    westWallBoard.position.set(-12.8, 2.1, 0.4);
    westWallBoard.rotation.y = Math.PI / 2;
    scene.add(westWallBoard);

    // West Staircase (visible & solid when westAligned)
    dynamicWestStairsGroup = new THREE.Group();
    const stepCount = 10;
    for (let i = 0; i < stepCount; i++) {
      const t = i / (stepCount - 1);
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.24, 0.48),
        new THREE.MeshStandardMaterial({
          color: state.westAligned ? 0xe8f6ff : 0x3b557d,
          emissive: state.westAligned ? 0x1f5678 : 0x091326,
          transparent: !state.westAligned,
          opacity: state.westAligned ? 0.96 : 0.28,
        })
      );
      step.position.set(-9.4, 0.2 + t * 3.0, -2.0 - t * 4.6);
      dynamicWestStairsGroup.add(step);
    }
    scene.add(dynamicWestStairsGroup);

    // Upper Mezzanine Balcony (Y = 3.2m, Z = -8.6)
    const mezzDeck = new THREE.Mesh(
      new THREE.BoxGeometry(19.0, 0.3, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x244370, roughness: 0.3, metalness: 0.2 })
    );
    mezzDeck.position.set(-2.0, 3.05, -8.6);
    scene.add(mezzDeck);

    // Portal on Mezzanine to Layer 2 (Stacks)
    const portalArch = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3.4, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x8ef2ff, emissive: 0x236e96, roughness: 0.15 })
    );
    portalArch.position.set(0, 4.9, -9.8);
    scene.add(portalArch);

    // North High Observation Platform (Y = 3.6m, Z = -16.2)
    const highDeck = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.35, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x294a7a, roughness: 0.3 })
    );
    highDeck.position.set(0, 3.42, -16.1);
    const surveyMonolith = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xf6c978, emissive: 0x5c3e12, roughness: 0.25 })
    );
    surveyMonolith.position.set(0, 4.35, -16.2);
    scene.add(highDeck, surveyMonolith);

    // Dynamic 3D Light Spline / Bridge
    dynamicLightTube = buildLightCurveMesh(getLightNodes());
    scene.add(dynamicLightTube);

    // East Wing: Pedestals + GLB models + Backstage Webpage Terminal
    const pedGeom = new THREE.CylinderGeometry(0.55, 0.65, 1.0, 16);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0xcfe4ff, roughness: 0.35 });
    const ped1 = new THREE.Mesh(pedGeom, pedMat);
    ped1.position.set(8.8, 0.5, -1.8);
    const ped2 = new THREE.Mesh(pedGeom, pedMat);
    ped2.position.set(8.8, 0.5, 1.8);
    scene.add(ped1, ped2);

    void loadGLB('/assets/p34/models/paper-prism-lamp.glb').then(model => {
      if (currentLayerId !== 'atrium') return;
      model.position.set(8.8, 1.05, -1.8);
      scene.add(model);
      animatedObjects.push(dt => { model.rotation.y += dt * 0.85; });
    });

    void loadGLB('/assets/p34/models/spatial-tuning-fork.glb').then(model => {
      if (currentLayerId !== 'atrium') return;
      model.position.set(8.8, 1.05, 1.8);
      scene.add(model);
      animatedObjects.push(dt => { model.rotation.y -= dt * 0.6; });
    });

    const termTex = makeTextPanelTexture(THREE, {
      title: 'BACKSTAGE TERMINAL // 2D ⇄ 3D',
      lines: [
        '> route_status: ?paper=0617 [ACTIVE]',
        `> west_staircase: ${state.westAligned ? 'ALIGNED (READY)' : 'LOOPING'}`,
        `> light_bridge: ${state.bridgeSolid ? 'SOLIDIFIED' : 'UNSHAPED'}`,
        '> [E / 点击] 打开终端面板与她的 2D 博客',
      ],
      accent: '#7eeeff',
      bg: '#0c1c36',
    });
    const termScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.2),
      new THREE.MeshBasicMaterial({ map: termTex })
    );
    termScreen.position.set(11.6, 1.9, 0);
    termScreen.rotation.y = -Math.PI / 2;
    scene.add(termScreen);
  }

  function populateStacks() {
    scene.background = new THREE.Color(0x080c18);
    scene.fog = new THREE.FogExp2(0x080c18, 0.024);

    const hemi = new THREE.HemisphereLight(0x7aa2e8, 0x090d1a, 0.8);
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
      new THREE.MeshStandardMaterial({ color: 0x131b30, roughness: 0.4, metalness: 0.25 })
    );
    floor.position.set(0, -0.15, 2.2);
    scene.add(floor);

    const grid = new THREE.GridHelper(24, 24, 0x3b588f, 0x182542);
    grid.position.y = 0.02;
    scene.add(grid);

    // Towering Archive Monolith Bookshelves (left & right abyssal walls)
    const stackMat = new THREE.MeshStandardMaterial({ color: 0x18233d, roughness: 0.55 });
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x72d6ff, emissive: 0x1d4e73, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const z = -6.0 + i * 2.8;
      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 14.0, 1.8), stackMat);
        tower.position.set(side * 10.0, 6.0, z);
        const spine = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.35, 1.5), spineMat);
        spine.position.set(side * 10.0, 2.2 + (i % 3) * 1.4, z);
        scene.add(tower, spine);
      }
    }

    // Girl's interactive sliding shelf
    dynamicSlidingShelf = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 4.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x263861, emissive: 0x101c36, roughness: 0.4 })
    );
    dynamicSlidingShelf.position.set(state.shelfMoved ? -5.2 : -1.2, 2.1, 4.2);
    scene.add(dynamicSlidingShelf);

    // West Reading Desk (Blog connection)
    const blogTex = makeTextPanelTexture(THREE, {
      title: '她的博客草图 · 跨站阅览席',
      lines: [
        '笔记：《走廊拐弯的时候，网页还没有加载完》',
        '西柱 → 朝向正门页缝（北）',
        '中柱 → 二层天桥标高 (+3.2m)',
        '东柱 → 雨夜倒车的窗沿',
      ],
      accent: '#f4be68',
      bg: '#161f36',
    });
    const blogBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.4),
      new THREE.MeshBasicMaterial({ map: blogTex })
    );
    blogBoard.position.set(-7.6, 2.0, 0.8);
    blogBoard.rotation.y = Math.PI / 3;
    scene.add(blogBoard);

    // East Relic Cabinet
    const relicTex = makeTextPanelTexture(THREE, {
      title: '封存的旧实验 · 挡板与砖块标本',
      lines: [
        '「平面里弹来弹去太挤了，我已经收进柜子当摆件啦」',
        '「现在把网页背面撑开搭成走廊，好玩多了」',
        '[E / 点击] 记录归档线索',
      ],
      accent: '#9ad8ff',
      bg: '#142038',
    });
    const relicBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.2),
      new THREE.MeshBasicMaterial({ map: relicTex })
    );
    relicBoard.position.set(7.6, 2.0, 0.8);
    relicBoard.rotation.y = -Math.PI / 3;
    scene.add(relicBoard);

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
      pillarMeshes[spec.key] = { group, column };
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

    const loftGate = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 3.8, 0.4),
      new THREE.MeshStandardMaterial({
        color: state.stacksUnlocked ? 0xf6c978 : 0x4c6699,
        emissive: state.stacksUnlocked ? 0x785016 : 0x162447,
      })
    );
    loftGate.position.set(0, 2.0, -12.2);
    scene.add(loftGate);
  }

  function populateLoft() {
    scene.background = new THREE.Color(0x16192e);
    scene.fog = new THREE.FogExp2(0x16192e, 0.02);

    const hemi = new THREE.HemisphereLight(0xb8c6ff, 0x1d1829, 0.95);
    scene.add(hemi);

    const warmLamp = new THREE.PointLight(0xf7c679, 2.6, 18);
    warmLamp.position.set(0, 3.4, -1.2);
    const windowLight = new THREE.PointLight(0x72dcff, 1.9, 16);
    windowLight.position.set(0, 3.0, -6.8);
    scene.add(warmLamp, windowLight);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x23243d, roughness: 0.45 })
    );
    floor.position.set(0, -0.15, 0);
    scene.add(floor);

    // Her Central Workbench + Miniature 3D World Hologram
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.95, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x3b3554, roughness: 0.5 })
    );
    bench.position.set(0, 0.48, -1.4);
    const holo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 1),
      new THREE.MeshStandardMaterial({ color: 0x7eeeff, emissive: 0x287699, wireframe: true })
    );
    holo.position.set(0, 1.55, -1.4);
    scene.add(bench, holo);
    animatedObjects.push(dt => {
      holo.rotation.y += dt * 0.7;
      holo.rotation.x += dt * 0.3;
    });

    void loadGLB('/assets/p34/models/paper-prism-lamp.glb').then(model => {
      if (currentLayerId !== 'loft') return;
      model.position.set(0.95, 0.98, -1.4);
      model.scale.setScalar(0.75);
      scene.add(model);
    });

    // Clue 1: Slot #34 Terminal (West)
    const c1Tex = makeTextPanelTexture(THREE, {
      title: '异常证据 I · #34 目录构建记录',
      lines: [
        'repo: Amiyadesi/project-34 (状态：未公开立项)',
        '仓库初始化: 2025-10-31 03:57:00',
        '底层目录出生: 2025-10-31 03:40:12 (早 17 分钟!)',
        '写入进程: <unnamed-resident> [仍在实时搭建房间]',
      ],
      accent: '#7eeeff',
      bg: '#141e38',
    });
    const c1Mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshBasicMaterial({ map: c1Tex }));
    c1Mesh.position.set(-4.6, 1.8, -2.2);
    c1Mesh.rotation.y = Math.PI / 4;
    scene.add(c1Mesh);

    // Clue 2: Dual-Handwriting Draft (East)
    const c2Tex = makeTextPanelTexture(THREE, {
      title: '异常证据 II · 正反双笔迹批注稿',
      lines: [
        '正面黑字(站长)：「未完成的实验全部从导航撤下」',
        '背面青字(她)：「你删掉的只是正面入口，背面又没塌」',
        '「我把剩下的页边距接起来，搭成了回廊和阁楼」',
        '「反正你也看不见，这几层归我啦」',
      ],
      accent: '#d6a8ff',
      bg: '#1c1a36',
    });
    const c2Mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshBasicMaterial({ map: c2Tex }));
    c2Mesh.position.set(4.6, 1.8, -2.2);
    c2Mesh.rotation.y = -Math.PI / 4;
    scene.add(c2Mesh);

    // Clue 3: Rain Window & Origin Trace (North)
    const c3Tex = makeTextPanelTexture(THREE, {
      title: '异常证据 III · 雨夜窗沿与合成声纹',
      lines: [
        '窗外正在循环《雨录进来了，车也是》的现场环境音',
        '声纹构成：被删掉的博客草稿 + 键盘残响 + 雨夜录音',
        '观测结论：她并非作者本人的复制品，而是真正活在',
        '这些网站背面的独立创作者——她究竟是怎么醒来的？',
      ],
      accent: '#f7c679',
      bg: '#152238',
    });
    const c3Mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.5), new THREE.MeshBasicMaterial({ map: c3Tex }));
    c3Mesh.position.set(0, 2.0, -7.2);
    scene.add(c3Mesh);
  }

  function rebuildLayerScene() {
    clearScene();
    state = getState();
    config = getLayerConfig(currentLayerId, state);
    layerTitleEl.textContent = config.title;
    layerSubtitleEl.textContent = config.subtitle;
    if (currentLayerId === 'atrium') populateAtrium();
    else if (currentLayerId === 'stacks') populateStacks();
    else populateLoft();
    syncCamera();
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
    activeTarget = findInteractiveTarget(player, player.yaw, player.pitch, config.interactables);
    reticle.dataset.active = String(Boolean(activeTarget));
    if (activeTarget) {
      promptBox.hidden = false;
      promptTitle.textContent = activeTarget.label;
      promptBtn.textContent = activeTarget.prompt;
    } else {
      promptBox.hidden = true;
    }
    const yStr = (player.y || 0).toFixed(1);
    compassEl.textContent = `${config.title} · 坐标 (${player.x.toFixed(1)}, ${yStr}m, ${player.z.toFixed(1)})`;
  }

  function openInspectorModal(title, renderContent) {
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

  function openSpatialOverviewModal(customTitle = '页背空间终端 · 层级导航与快速操作') {
    state = getState();
    openInspectorModal(customTitle, body => {
      const wrap = document.createElement('div');
      wrap.className = 'world3d-inspector-grid';
      wrap.innerHTML = `
        <section class="world3d-inspector-sec">
          <h3>已发现的 3D 层级</h3>
          <div class="world3d-layer-list" data-modal-layers></div>
        </section>
        <section class="world3d-inspector-sec">
          <h3>当前层级可交互目标（支持直接触发）</h3>
          <div class="world3d-hotspot-list" data-modal-hotspots></div>
        </section>
        <section class="world3d-inspector-sec">
          <h3>2D / 3D 跨界面板与出口</h3>
          <div class="world3d-room-links">
            <button type="button" data-open-room="lab">2D 实验室《拉住一束光》</button>
            <button type="button" data-open-room="blog">她的 2D 博客与空间草图</button>
            <button type="button" data-open-room="archive">线索档案与存档 (${state.clues.length}/5)</button>
            <button type="button" data-open-room="guestbook">公开留言板</button>
            <button type="button" data-leave-normal>返回正常网页</button>
          </div>
        </section>
      `;
      const layerList = wrap.querySelector('[data-modal-layers]');
      for (const l of LAYERS) {
        const unlocked =
          state.layers.includes(l) ||
          (l === 'stacks' && (state.westAligned || state.bridgeSolid)) ||
          (l === 'loft' && state.stacksUnlocked);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.disabled = !unlocked;
        btn.dataset.switchLayer = l;
        btn.setAttribute('aria-current', String(l === currentLayerId));
        btn.textContent = unlocked ? `${LAYER_LABELS[l]}${l === currentLayerId ? '（当前所在）' : ''}` : `${LAYER_LABELS[l]}（未抵达）`;
        btn.addEventListener('click', () => {
          closeModal();
          switchLayer(l);
        });
        layerList.append(btn);
      }

      const hotspotList = wrap.querySelector('[data-modal-hotspots]');
      for (const item of config.interactables) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.hotspot = item.id;
        b.innerHTML = `<strong>${item.label}</strong><span>${item.prompt}</span>`;
        b.addEventListener('click', () => {
          closeModal();
          player.x = item.x + Math.sin(player.yaw) * 1.4;
          player.z = item.z + Math.cos(player.yaw) * 1.4;
          player.y = computeFloorElevation(player.x, player.z, item.y || 0, config.surfaces);
          syncCamera();
          updateTargetPrompt();
          triggerInteraction(item);
        });
        hotspotList.append(b);
      }

      wrap.querySelectorAll('[data-open-room]').forEach(btn => {
        btn.addEventListener('click', () => {
          closeModal();
          onOpenRoom?.(btn.dataset.openRoom);
        });
      });
      wrap.querySelector('[data-leave-normal]').addEventListener('click', () => {
        closeModal();
        onLeaveSite?.();
      });

      body.append(wrap);
    });
  }

  function triggerInteraction(target = activeTarget) {
    if (!target) return false;
    motion?.tone?.(2, true);
    state = getState();

    if (target.kind === 'seam') {
      openInspectorModal('网页视口背面 · 接缝门', body => {
        body.innerHTML = `
          <p>透过这层半透明的 DOM 背面，能看见正常主页 <code>sayori.org</code> 的标题和纸角。</p>
          <p>你可以继续在 3D 层级世界里探索，也可以随时穿回正常的 2D 网页。</p>
          <div class="world3d-room-links">
            <button type="button" data-stay>继续留在 3D 页背世界</button>
            <button type="button" data-exit-normal>穿回正常网页</button>
          </div>
        `;
        body.querySelector('[data-stay]').addEventListener('click', closeModal);
        body.querySelector('[data-exit-normal]').addEventListener('click', () => {
          closeModal();
          onLeaveSite?.();
        });
      });
      return true;
    }

    if (target.kind === 'lab-link') {
      onInteract?.('lab-link', target);
      onOpenRoom?.('lab');
      return true;
    }

    if (target.kind === 'sightline') {
      onSightlineAligned?.();
      state = getState();
      config = getLayerConfig(currentLayerId, state);
      rebuildLayerScene();
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
      openInspectorModal('跨站阅览席 · 她的 2D 博客与《走廊拐弯的时候》', body => {
        body.innerHTML = `
          <p>桌面上摊开着她在 <code>blog.sayori.org/?paper=0617</code> 写的空间草图笔记：</p>
          <blockquote>
            「书库北面那扇通往阁楼的门，靠三根空间基准柱锁着相位：<br>
            1. <strong>西柱（视口折向）</strong>：对准 <strong>朝向正门页缝（北）</strong><br>
            2. <strong>中柱（楼层标高）</strong>：升至 <strong>二层天桥 +3.2m</strong><br>
            3. <strong>东柱（留存声轨）</strong>：切到 <strong>雨夜倒车的窗沿</strong>」
          </blockquote>
          <div class="world3d-room-links">
            <button type="button" data-calibrate-here>在此校准 2D 折页草图并投射光束</button>
            <button type="button" data-go-blog>前往 2D 博客全文阅读</button>
          </div>
        `;
        body.querySelector('[data-calibrate-here]').addEventListener('click', () => {
          onInteract?.('blog-blueprint', target);
          closeModal();
          rebuildLayerScene();
        });
        body.querySelector('[data-go-blog]').addEventListener('click', () => {
          closeModal();
          onOpenRoom?.('blog');
        });
      });
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
        openInspectorModal('跨站草图投影仪（待接收 2D 博客折线信号）', body => {
          body.innerHTML = `
            <p>这台投影仪连接着她的 2D 博客笔记《走廊拐弯的时候》。</p>
            <p>你可以去西侧的跨站阅览台或她的 2D 博客把草图折线拉直，也可以直接观察线索手动旋转三根基准柱。</p>
            <div class="world3d-room-links">
              <button type="button" data-open-blog>打开她的 2D 博客草图</button>
              <button type="button" data-close>返回 3D 书库自己调柱子</button>
            </div>
          `;
          body.querySelector('[data-open-blog]').addEventListener('click', () => {
            closeModal();
            onOpenRoom?.('blog');
          });
          body.querySelector('[data-close]').addEventListener('click', closeModal);
        });
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
      if (dest === 'stacks' && !state.westAligned && !state.bridgeSolid && !state.layers.includes('stacks')) {
        onInteract?.('portal-locked-stacks', target);
        return false;
      }
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
            <p class="world3d-clue-saved">✓ 已记录至「档案与发现」(${state.clues.length} / 5)</p>
            <div class="world3d-room-links">
              <button type="button" data-keep-exploring>继续探索</button>
              <button type="button" data-view-archive>查看全部线索档案</button>
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
    if (nextLayer === 'stacks' && !state.westAligned && !state.bridgeSolid && !state.layers.includes('stacks')) {
      onInteract?.('portal-locked-stacks');
      return false;
    }
    if (nextLayer === 'loft' && !state.stacksUnlocked && !state.layers.includes('loft')) {
      onInteract?.('portal-locked-loft');
      return false;
    }
    currentLayerId = nextLayer;
    onLayerChange?.(nextLayer, { push });
    state = getState();
    config = getLayerConfig(currentLayerId, state);
    player = { ...config.spawn };
    if (nextLayer === 'stacks' && !state.shelfMoved) {
      onShelfMoved?.();
      state = getState();
    }
    rebuildLayerScene();
    return true;
  }

  function stepMovement(dt) {
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
      const next = resolvePlayerMovement(player, player.x + dx, player.z + dz, config, state);
      const moved = Math.hypot(next.x - player.x, next.z - player.z);
      player.x = next.x;
      player.y = next.y;
      player.z = next.z;
      if (next.looped) {
        onLoopWalked?.();
      }
      if (moved > 0.001) {
        bobPhase += moved * 3.6;
        stepDistance += moved;
        if (stepDistance >= 2.2) {
          stepDistance = 0;
          motion?.tone?.(1, false);
        }
      }
      // Auto sightline check when standing in West Gallery Vantage Circle
      if (currentLayerId === 'atrium' && !state.westAligned && checkSightlineAlignment(player, player.yaw)) {
        onSightlineAligned?.();
        state = getState();
        config = getLayerConfig(currentLayerId, state);
        rebuildLayerScene();
      }
    }
    syncCamera();
    updateTargetPrompt();
  }

  function nudgeMove(dir) {
    const step = 1.1;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    let dx = 0, dz = 0;
    if (dir === 'forward') { dx = -sin * step; dz = -cos * step; }
    else if (dir === 'back') { dx = sin * step; dz = cos * step; }
    else if (dir === 'left') { dx = -cos * step; dz = sin * step; }
    else if (dir === 'right') { dx = cos * step; dz = -sin * step; }
    const next = resolvePlayerMovement(player, player.x + dx, player.z + dz, config, state);
    player.x = next.x; player.y = next.y; player.z = next.z;
    if (next.looped) onLoopWalked?.();
    if (currentLayerId === 'atrium' && !state.westAligned && checkSightlineAlignment(player, player.yaw)) {
      onSightlineAligned?.();
      state = getState();
      config = getLayerConfig(currentLayerId, state);
      rebuildLayerScene();
    }
    syncCamera();
    updateTargetPrompt();
  }

  // Event Listeners
  const listen = (el, type, fn, opts) => el.addEventListener(type, fn, { signal, ...opts });

  listen(window, 'resize', updateSize);
  listen(document, 'pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === viewport;
    lockBtn.textContent = pointerLocked ? '按 Esc 退出鼠标锁定' : '鼠标视角 (Click)';
    root.dataset.pointerLocked = String(pointerLocked);
  });

  listen(viewport, 'click', () => {
    if (!modal.hidden) return;
    if (activeTarget && !pointerLocked) {
      triggerInteraction(activeTarget);
      return;
    }
    try { viewport.requestPointerLock?.(); } catch {}
  });

  listen(lockBtn, 'click', () => {
    if (pointerLocked) document.exitPointerLock?.();
    else try { viewport.requestPointerLock?.(); } catch {}
  });

  listen(inspectorBtn, 'click', () => openSpatialOverviewModal());
  listen(modalClose, 'click', closeModal);
  listen(promptBtn, 'click', e => {
    e.stopPropagation();
    triggerInteraction(activeTarget);
  });

  listen(viewport, 'pointerdown', e => {
    if (pointerLocked || e.button !== 0) return;
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
    if (e.target.matches?.('input, textarea, select')) return;
    if (e.code === 'Escape') {
      if (closeModal()) {
        e.preventDefault();
        return;
      }
    }
    if (!modal.hidden) return;
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

  root.querySelectorAll('[data-step]').forEach(btn => {
    listen(btn, 'click', () => nudgeMove(btn.dataset.step));
  });
  root.querySelectorAll('[data-turn]').forEach(btn => {
    listen(btn, 'click', () => {
      player.yaw += btn.dataset.turn === 'left' ? 0.38 : -0.38;
      syncCamera();
      updateTargetPrompt();
    });
  });
  listen(root.querySelector('[data-touch-interact]'), 'click', () => {
    if (activeTarget) triggerInteraction(activeTarget);
    else openSpatialOverviewModal();
  });

  function animate(now) {
    if (signal?.aborted) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    if (modal.hidden) stepMovement(dt);
    for (const fn of animatedObjects) fn(dt);
    if (renderer) renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }

  updateSize();
  rebuildLayerScene();
  rafId = requestAnimationFrame(animate);

  const api = {
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
      if (currentLayerId === 'atrium' && !state.westAligned && checkSightlineAlignment(player, player.yaw)) {
        onSightlineAligned?.();
      }
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
      if (state.currentLayer && state.currentLayer !== currentLayerId && LAYERS.includes(state.currentLayer)) {
        currentLayerId = state.currentLayer;
        config = getLayerConfig(currentLayerId, state);
        player = { ...config.spawn };
      }
      rebuildLayerScene();
    },
    dispose() {
      cancelAnimationFrame(rafId);
      if (document.pointerLockElement === viewport) document.exitPointerLock?.();
      clearScene();
      renderer?.dispose?.();
      root.remove();
    },
  };

  container.__p34World = api;
  if (typeof window !== 'undefined') window.__p34World = api;
  signal?.addEventListener('abort', () => api.dispose(), { once: true });
  return api;
}
