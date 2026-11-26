import {
  LAYERS,
  LAYER_LABELS, canEnterLayer, isSilenced,
  TARGET_PILLARS,
  CLUE_INFO,
  GARDEN_SKIES,
} from './p34-journey.js?v=20261126-playable';
import { createBuilding, galleryEnvironment } from './p34-building.js?v=20261126-playable';
import { addResidents } from './p34-residents.js?v=20261126-playable';
import { createWorldAudio } from './p34-audio.js?v=20261126-playable';
import { SUNDIAL, CHIMES, GARDEN_LIGHT, skyFromHour, entrySpawn, inPool, dailyNote, addAtriumGarden, addStacksGarden, addLoftGarden } from './p34-garden.js?v=20261126-playable';
import { lightPoint } from './p34-light.js?v=20261126-playable';
import { createPresentation, makeBook, bookPose } from './p34-presentation.js?v=20261126-playable';
import { LINES } from './p34-script.js?v=20261126-playable';
import { createBody, queueJump, advanceBody, TICK } from './p34-kinematics.js?v=20261126-playable';
import { createPlayroom } from './p34-play.js?v=20261126-playable';

import { deepConfig, deepCrossing, populateDeep } from './p34-deep.js?v=20261126-playable';
import { atriumVista, stacksVista, libraryVista, loftVista, skyDome } from './p34-vistas.js?v=20261126-playable';

const EYE_HEIGHT = 1.65;
const FOLD_DESK = { x: -5.65, z: .2 };
function portal(from, targetLayer, x, z, direction, floorY = 0, axis = 'z') {
  return { id: `portal-${from}-${targetLayer}`, kind: 'portal', targetLayer,
    label: LAYER_LABELS[targetLayer] || '阅览室', prompt: '走入', x, y: floorY + 1.45, z, floorY,
    crossing: { [axis]: axis === 'x' ? x : z, halfWidth: 1.35, direction } };
}

const landingDistance = 1.65;
export function layerEntrySpawn(config, source) {
  const from = source === 'library-exit' ? 'library' : source?.split('-')[1];
  const door = from && config.interactables.find(i => i.crossing && (i.targetLayer === from || (i.kind === 'library-exit' && from === 'stacks')));
  if (!door) return { ...config.spawn };
  const plane = door.crossing, dx = 'x' in plane ? -plane.direction : 0, dz = dx ? 0 : -plane.direction;
  const x = (plane.x ?? door.x) + dx * landingDistance, z = (plane.z ?? door.z) + dz * landingDistance;
  return { x, y: door.floorY ?? 0, z, yaw: Math.atan2(-dx, -dz) || 0, pitch: 0 };
}

const flat = (id, minX, maxX, minZ, maxZ, yStart = 0, yEnd = yStart, axis = 'flat') =>
  ({ id, minX, maxX, minZ, maxZ, yStart, yEnd, axis, enabled: true });

// The east wing wraps by four identical bays; the junction stays behind the turn.
export function wrapWing(before, after, config) {
  if (config.id !== 'atrium' || config.wingReleased || after.y>2.2 || after.x < 18.5 || after.x > 23.5) return null;
  if (before.z > -48 && after.z <= -48) return { ...after, z: after.z + 24 };
  return null;
}

export function getLibraryConfig(posts) {
  const positions = [[-5.6, 5], [5.6, 1], [-5.6, -5], [5.6, -10], [-5.6, -15]];
  return {
    id: 'library', title: '阅览室',
    spawn: { x: 0, y: 0, z: 9, yaw: 0, pitch: 0 },
    interactables: [
      { id: 'library-exit', label: '书库', prompt: '走入', kind: 'library-exit', targetLayer: 'stacks', x: 0, y: 1.5, z: 11.2, crossing: { z: 10.7, direction: 1, halfWidth: 1.35 } },
      ...posts.map((post, i) => ({ id: `book-${post.slug}`, label: post.title, prompt: 'E · 翻开', kind: 'book', slug: post.slug, x: positions[i][0], y: 1.2, z: positions[i][1] })),
    ],
  };
}

export function getLayerConfig(layer, state = {}) {
  const room = authoredConfig(layer, state);
  if (isSilenced(state, layer)) {
    room.interactables = room.interactables.filter(i => i.crossing || i.kind === 'memory-trace' ||
      (layer === 'loft' && ['talk-bench','cocreate'].includes(i.kind)));
  }
  return room;
}

function authoredConfig(layer, state) {
  if (layer === 'poolrooms' || layer === 'drafts') return deepConfig(layer, state);
  if (layer === 'atrium') {
    return {
      id: 'atrium',
      title: LAYER_LABELS.atrium,
      wingReleased: isSilenced(state,layer) && state.traces?.includes('atrium'),
      spawn: { x: 0, y: 0, z: 8.8, yaw: 0, pitch: 0 },

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
          ...FOLD_DESK, y: 1.15,
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
        portal('atrium', 'poolrooms', 0, -17.45, -1, 3.6),
        ...((state.phase === 'closed' || state.phase === 'loft' || state.phase === 'after' || state.layers?.includes('drafts')) ? [portal('atrium','drafts',-15,17.8,1)] : []),
        ...((state.legacyLoft || state.layers?.includes('loft') || state.phase === 'after') ? [portal('atrium','loft',8.3,17.8,1)] : []),
        ...(isSilenced(state, layer) && !state.traces?.includes('atrium') ? [{ id: 'trace-atrium', kind:'memory-trace', ...SUNDIAL, label:'静下来的晷针', prompt:'E · 听'}] : []),
        {
          id: 'high-platform-survey',
          label: '测绘纸',
          prompt: 'E · 阅读',
          x: -2.6, y: 4.9, z: -16.2, floorY: 3.6,
          kind: 'clue',
          clueId: 'atrium-survey',
        },
        ...(state.phase === 'arrive' ? [{
          id: 'arrival-echo',
          label: '她',
          prompt: 'E · 问问她',
          x: 2.1, y: 1.55, z: 5.2,
          kind: 'talk-arrival',
        }] : []),
      ],
    };
  }

  if (layer === 'stacks') {
    const unlocked = Boolean(state.stacksUnlocked || state.phase === 'after');
    return {
      id: 'stacks',
      title: LAYER_LABELS.stacks,
      spawn: { x: 0, y: 3.55, z: 15.4, yaw: 0, pitch: -.08 },
      surfaces: [
        flat('index-front', -12,12,-7.5,2.2), flat('index-rear', -12,12,7.2,10.4),
        flat('index-spine', -1.55,1.55,2.2,7.2), flat('west-gallery',-12,-6.1,2.2,7.2), flat('east-gallery',6.1,12,2.2,7.2),
        flat('stack-entry-stairs',-8.9,8.9,10.3,15.4,3.55,0,'-z'), flat('stack-entry-loggia',-8.9,8.9,15.4,18.4,3.55),
        { id: 'north-bridge', minX: -2.5, maxX: 2.5, minZ: -18, maxZ: -7.2, yStart: 0, yEnd: 4.5, axis: '-z', enabled: unlocked },
        { ...flat('north-loggia', -6, 6, -25.5, -18, 4.5), enabled: unlocked },
      ],
      interactables: [
        ...['lamp', 'folio', 'blank'].map((specimen, i) => ({ id: `specimen-${specimen}`, label: ['桌灯标本', '笔记折页', '第 34 号空白铭牌'][i], prompt: 'E · 近看', kind: 'garden-specimen', specimen, x: [-7.2, -4.6, 7.2][i], y: 1.15, z: 8.3 })),
        portal('stacks', 'poolrooms', 0, 17.45, 1, 3.55),
        { ...portal('stacks', 'library', -11.35, .8, -1, 0, 'x'), kind:'gallery-door' },
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
        portal('stacks','drafts',0,-24.3,-1,4.5),
      ],
    };
  }

  // Layer 3: loft
  return {
    id: 'loft',
    title: LAYER_LABELS.loft,
    spawn: { x: 0, y: 0, z: 6.2, yaw: 0, pitch: 0 },
    interactables: [
      { id: 'loft-daily-note', label: '桌边短笺', prompt: 'E · 翻看', kind: 'loft-daily-note', x: -3.1, y: 1.05, z: 2.3 },
      portal('loft','drafts',0,7.9,1),
      ...((state.legacyLoft || state.layers?.includes('loft') || state.phase === 'after') ? [portal('loft','atrium',5.3,7.9,1)] : []),
      { id:'cocreate', kind:'cocreate', label:'共创台', prompt:'E · 调整', x:0, y:1.48, z:-.79 },
      {
        id: 'her-workbench',
          label: '工作台',
          prompt: 'E · 聊聊',
        x: 1.42, y: 1.4, z: -1.6,
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
        x: 3.4, y: 1.6, z: -6.8,
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

export function crossedDoor(before, after, interactables) {
  return interactables.find(door => {
    const threshold = door.crossing;
    if (!threshold || Math.abs(after.y - (door.floorY || 0)) > .9) return false;
    const axis = 'x' in threshold ? 'x' : 'z', side = axis === 'x' ? 'z' : 'x';
    return Math.abs(after[side] - door[side]) <= threshold.halfWidth &&
      (before[axis] - threshold[axis]) * threshold.direction < 0 && (after[axis] - threshold[axis]) * threshold.direction >= 0;
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
  mountFoldDesk, mountCreationDesk,
  onLeaveSite,
  library = null,
  signal,
}) {
  const THREE = await import('./third-party/three/three.module.min.js');
  const { GLTFLoader } = await import('./third-party/three/GLTFLoader.js');
  const css3d = await import('./third-party/three/CSS3DRenderer.js');
  if (signal?.aborted) return null;

  const root = document.createElement('div');
  root.className = 'world3d-stage';
  root.innerHTML = `
    <div class="world3d-viewport" data-viewport tabindex="0" role="application" aria-label="三维页背探索空间，WASD 移动，拖动环视，空格跳跃，E 互动，G 寻路"></div>
    <div class="world3d-reticle" data-reticle aria-hidden="true"><span></span></div>
    <header class="world3d-hud-top">
      <button type="button" data-guide class="world3d-chip" aria-label="纸飞机寻路" title="纸飞机寻路 · G"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 18-6-6 16-4-7-8-3Zm8 3L21 4"/></svg></button>
      <button type="button" data-inspector-btn class="world3d-chip" aria-label="暂停" title="暂停 · Esc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg></button>
    </header>
    <p class="world3d-help" data-help>WASD 移动 · 空格跳跃 · E 互动 · G 寻路</p>
    <p class="world3d-aside" data-aside role="status"></p>
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
        <button type="button" data-jump aria-label="跳跃">跳跃</button>
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
  let software = false;
  try {
    let isSoftwareGL = false;
    try {
      const probe = document.createElement('canvas').getContext('webgl');
      const dbg = probe?.getExtension('WEBGL_debug_renderer_info');
      const glName = dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      isSoftwareGL = /SwiftShader|llvmpipe|Software/i.test(glName);
    } catch {}
    software = isSoftwareGL;
    renderer = new THREE.WebGLRenderer({ antialias: !isSoftwareGL, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = isSoftwareGL ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
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
  scene.userData.software = software;
  const environment = renderer && galleryEnvironment(THREE, renderer);
  if (environment) scene.environment = environment.texture;
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.08, 260);
  camera.rotation.order = 'YXZ';
  const pages = new THREE.Scene();
  const pageRenderer = new css3d.CSS3DRenderer();
  pageRenderer.domElement.className = 'world3d-pages';
  root.append(pageRenderer.domElement);
  const presentation=createPresentation(THREE,camera,motion.reduced);
  const bookRigs=new Map();
  let reading = null, readingObject = null;
  const veil=document.createElement('div');veil.className='world3d-threshold-veil';veil.inert=true;root.append(veil);
  function travel(arrive){
    keys.clear();resetTouchStick();draggingLook=false;lookPointerId=null;
    presentation.travel(arrive,a=>{veil.style.opacity=a;});
  }
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
      typographyMount ||= import('./p34-typography.js?v=20261126-playable').then(m => m.createSpatialDialogue({ signal, reduced: motion.reduced }));
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
  const from = new URL(location.href).searchParams.get('from');
  let player = createBody(currentLayerId === 'atrium'
    ? entrySpawn(config.spawn, location.href)
    : layerEntrySpawn(config, from === 'blog' ? 'library-exit' : from === 'stacks' ? 'portal-stacks-library' : null));
  const playMemory = {}, aside = root.querySelector('[data-aside]');
  let play, asideTime=0, accumulator=0, nudgeTime=0, nudgeCode;
  function remark(text) {
    if(isSilenced(state,currentLayerId) || !text) return;
    aside.textContent=text; aside.dataset.visible='true'; asideTime=3.1;
  }
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
  let atriumBridge = null;
  let updateBridge = null, stacksViaduct = null;
  let dynamicSlidingShelf = null;
  let lampLightRef = null;
  let residents = null;
  let building = null;
  let foldModel, foldKnobs, foldProfile, foldPoints;
  let deepRoom, wingIndex, dome, sculpture, sculptureTone;
  let wingLoops = 0, echoHeard = false;
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
    // Software rasterization is fill-rate limited. Keep real shadows and the complete horizon;
    // cap the framebuffer instead. CSS controls and reading pages stay at native resolution.
    const softwareWidth = currentLayerId === 'stacks' && !library ? 480 : 608;
    renderer?.setDrawingBufferSize(w, h, software ? Math.min(.75, softwareWidth / w) : Math.min(window.devicePixelRatio || 1, 1.75));
    pageRenderer.setSize(w, h);
    typography?.resize(w, h);
    if (readingObject && presentation.mode!=='return') frameReading();
  }

  function frameReading() {
    const rig=bookRigs.get(readingObject.name), p=rig.root.position, portrait=camera.aspect<.85;
    const width=Math.min(445,Math.max(270,viewport.clientHeight*.51),viewport.clientWidth*.79);
    const scale=.607/width;
    Object.assign(readingObject.element.style,{width:width+'px',height:(.797/scale)+'px'});
    readingObject.scale.setScalar(scale);
    readingObject.rotation.x=-Math.PI/2;
    readingObject.position.set(p.x+.335,rig.baseY+.146,p.z);
    // Portrait favors the text leaf; landscape keeps the illustration and exposed boards in frame.
    const aim=new THREE.Vector3(p.x+(portrait ? .31 : -.022),rig.baseY+(portrait ? .147 : .194),p.z-.005);
    const dist=Math.max(1.13,(portrait ? .82 : 1.62)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
    presentation.focus('book',aim.clone().add(new THREE.Vector3(0,dist*.942,dist*.336)),aim,rig);
  }

  function mountSpread(target,element) {
    readingObject=new css3d.CSS3DObject(element);
    readingObject.name=target.id;element.style.opacity='0';element.inert=true;
    pages.add(readingObject);frameReading();pageRenderer.render(pages,camera);
    audio.playInteraction('book');
  }
  function putBack(done) {
    const article=readingObject;
    presentation.close(()=>{
      pages.remove(article);readingObject=null;reading=null;
      root.dataset.reading='false';done?.();updateTargetPrompt();viewport.focus({preventScroll:true});
    });
    audio.playInteraction('flip');
  }
  function updatePresentation(dt){
    presentation.tick(dt);updateBridge?.(dt);
    if(readingObject){
      const ink=bookPose(presentation.amount).ink, el=readingObject.element;
      el.style.opacity=ink;el.inert=ink<.55 || presentation.mode==='return';
      if(!el.inert && !el.contains(document.activeElement) && el.dataset.focusPage==='true'){
        delete el.dataset.focusPage;el.querySelector('[data-index],[data-modal-close]')?.focus({preventScroll:true});
      }
      pageRenderer.render(pages,camera);
    }
  }
  function readBook(post, element) {
    keys.clear(); draggingLook = false; lookPointerId = null; resetTouchStick();
    if (!post) {
      if(reading)putBack();
      return;
    }
    if(readingObject)pages.remove(readingObject);
    reading=post;root.dataset.reading='true';
    modal.hidden = true;
    if (document.pointerLockElement === viewport) document.exitPointerLock?.();
    const target = config.interactables.find(i => i.slug === post.slug);
    element.dataset.focusPage='true';mountSpread(target,element);updateTargetPrompt();
  }

  function clearScene() {
    buildId++;
    asideTime=0;delete aside.dataset.visible;
    bookRigs.clear();updateBridge=null;stacksViaduct=null;
    foldModel = foldKnobs = foldProfile = foldPoints = null;
    echoHeard = false;
    deepRoom?.dispose(); deepRoom = wingIndex = dome = sculpture = null; sculptureTone = undefined;
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
    atriumBridge = null;
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
    dir.shadow.mapSize.setScalar(software ? 768 : 2048);
    Object.assign(dir.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: .5, far: 65 });
    dir.shadow.normalBias = .036;
    dir.shadow.radius = 3;
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

    building = createBuilding(THREE, scene, renderer, { software });
    const { box, floor: floorMat, ceiling: ceilingMat, wood: timber, metal } = building;
    box(27, .2, 25, 0, -.1, 0, floorMat);
    for (const side of [-1, 1]) box(10.5,.3,29,side*18.75,-.15,5.5,floorMat);
    box(27,.3,7.5,0,-.15,16.25,floorMat);
    // The eaves belong to the side cloisters; the central court is open to the sky.
    for(const x of [-18.5,18.5]){
      box(9.2,.42,28,x,6.22,5.4,ceilingMat);
      for (const z of [-8.6,.7,10,19.3]) {
        for (const sx of [-4.2,4.2]) building.column(.72,6.01,.72,x+sx,0,z);
        building.arch(x,2.05,z,7.56,.14,.51,.74);
      }
      for(const z of [-4,5.3,14.6]) for(const sx of [-4.2,4.2]) building.arch(x+sx,1.48,z,8.6,.18,.53,.64,Math.PI/2);
    }
    for(const x of [-20,20]) {box(7.8,.7,.46,x,.35,19.6,building.plaster); box(8,.09,.58,x,.73,19.6,building.edge);}
    for (const [x,z] of [[22.7,-5.5],[-22.9,12]]) {building.slab(1.12,.16,3.6,x,.52,z,timber);box(.46,.48,3.2,x,.24,z,timber);}
    box(4.7,.18,6,21.15,2.11,11,floorMat);
    box(4.7,.12,.12,21.15,3.05,8,timber);
    for(const x of [18.8,20.35,21.9,23.5])box(.06,.85,.06,x,2.63,8,timber);
    for(let i=0;i<10;i++)box(2.6,.22,.4,21.3,.11+i*.22,17.8-i*.4,floorMat);
    // A summerhouse frame over the fold-desk, rather than a wall across the axis.
    building.wall(.8,2.8,5.7,-7,0,-3.35);
    const seamMat = new THREE.MeshStandardMaterial({color:0xafaa94,roughness:.3,metalness:.33});
    building.arch(0,0,12.1,3.3,1.7,.28,.35,0,seamMat);
    const invChair = new THREE.Group();invChair.position.set(-14.5,6.02,16.4);invChair.rotation.set(Math.PI,.38,0);
    box(.48,.05,.48,0,.48,0,timber,invChair);box(.48,.5,.05,0,.75,-.21,timber,invChair);
    for(const x of [-.2,.2])for(const z of [-.2,.2])box(.045,.48,.045,x,.24,z,timber,invChair);scene.add(invChair);
    wingIndex = atriumVista(THREE,scene,building); wingIndex.rotation.y=wingLoops*Math.PI/2;
    gardenLighting = { hemi, dir, centerLight };
    for(const door of config.interactables.filter(i=>i.kind==='portal')){
      building.arch(door.x,door.floorY,door.z,3.4,2.18,.48,.71,0,building.paint);
      building.arch(door.x,door.floorY,door.z+.38,3.62,2.16,.14,.13,0,building.edge);
    }
    // Four open arches join at the stone capitals around the skylight.
    for (const cx of [-4, 4]) for (const cz of [-4, 4]) building.column(1.2, 3.2, 1.2, cx, 0, cz).userData.solidId='courtyard-column';
    for (const side of [-4, 4]) for (const [x, z, yaw] of [[0, side, 0], [side, 0, Math.PI / 2]]) {
      building.arch(x, 3.15, z, 7.12, .03, .73, .72, yaw);
      building.arch(x + .41 * Math.sin(yaw), 3.17, z + .41 * Math.cos(yaw), 7.28, .03, .15, .11, yaw, building.edge);
    }
    for (const side of [-1, 1]) {
      for (const z of [-5.35, 4.35]) building.arch(side * 13.33, 0, z, 2.95, 2.22, .31, .5, Math.PI / 2);
      building.arch(side * 8.3, 0, -8.7, 5.1, 2.46, .42, .55, 0, building.paint);
    }

    // The west stairs are ordinary architecture, not an invisible sightline lock.
    for (let i = 0; i < 13; i++) {
      const z = -2 - i * .375, y = .12 + i * .245;
      building.slab(3.85, .19, .48, -9.4, y - .095, z, building.plaster);
      box(3.6, .023, .048, -9.4, y - .025, z + .247, building.edge);
    }

    // Upper Mezzanine Balcony (Y = 3.2m, Z = -8.6)
    building.slab(19, .34, 3.98, -1.95, 3.03, -8.59, building.plaster);
    building.slab(19.06, .08, 3.96, -1.95, 3.17, -8.59, building.edge);
    for (const x of [-5.6, 5.25]) building.arch(x, .02, -8.65, 3.35, 1.25, .27, .46);

    // Low bridge buttresses leave the doorway and sky legible from ground level.
    for (const x of [-2.15,2.15]) box(.42,.8,2,x,3.6,-9.4,building.paint);
    // North High Observation Platform (Y = 3.6m, Z = -16.2)
    building.slab(8.4, .35, 4.2, 0, 3.42, -16.1, building.plaster);
    building.slab(8.1, .12, 4.1, 0, 3.2, -16.1, building.paint);
    const surveyMonolith = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xb6ac8e, roughness: 1 })
    );
    surveyMonolith.position.set(-2.6, 4.35, -16.2);
    scene.add(building.solid(surveyMonolith));

    const { x: foldX, z: foldZ } = FOLD_DESK;
    building.lathe([[0, 0], [.47, 0], [.47, .08], [.37, .17], [.26, .29], [.25, .67], [.43, .87], [.43, .92], [0, .92]], foldX, 0, foldZ, building.paint);
    building.slab(1.08, .14, .92, foldX, .92, foldZ, building.edge).userData.solidId='fold-desk';
    const folio = new THREE.Group(); folio.position.set(foldX, 1.04, foldZ); folio.rotation.y = -.18; scene.add(folio);
    const paper = new THREE.MeshStandardMaterial({ color: 0xffebcf, roughness: .8 });
    for (const side of [-1, 1]) {
      const leaf = building.slab(.35, .023, .44, side * .17, 0, 0, paper, folio);
      leaf.rotation.z = side * -.20;
    }

    // The drafting controls bend this translucent standing study above the physical folio.
    foldModel=new THREE.Group();foldModel.position.set(foldX,1.13,foldZ);foldModel.visible=false;scene.add(foldModel);
    const vellum=new THREE.Mesh(new THREE.PlaneGeometry(2.7,1.26),new THREE.MeshStandardMaterial({color:0xe6efdc,emissive:0x779d93,emissiveIntensity:.2,transparent:true,opacity:.25,side:THREE.DoubleSide,depthWrite:false}));
    vellum.position.y=.65;foldModel.add(vellum);
    const pins=new THREE.MeshStandardMaterial({color:0xfff2bc,emissive:0xbf8656,emissiveIntensity:.8,roughness:.38});
    foldKnobs=Array.from({length:4},()=>{const pin=new THREE.Mesh(new THREE.SphereGeometry(.045,10,6),pins);foldModel.add(pin);return pin;});
    foldProfile=new THREE.Mesh(new THREE.BufferGeometry(),pins);foldModel.add(foldProfile);
    // Saved sketch produces a usable bridge, not a decorative ribbon.
    atriumBridge = new THREE.Group();scene.add(atriumBridge);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xc1f0e8, emissive: 0x4c8494, emissiveIntensity: .78, roughness: .34 });
    const parts=Array.from({length:9},(_,i)=>{
      const g=new THREE.Group();atriumBridge.add(g);g.userData.movingSolid=true;g.userData.solidId='light-bridge';g.userData.stepMaterial='glass';
      const z=-10.19-(i+.5)*.46, top=3.2+(i+.5)*.045;
      g.position.set(0,top-.075,z);g.rotation.x=.097;
      building.slab(4.8,.15,.464,0,0,0,bridgeMat,g);
      for(const x of [-2.32,2.32]) building.slab(.07,.026,.46,x,.084,0,building.edge,g);
      return {g,base:g.position.y};
    });
    let wave=state.bridgeSolid || state.phase==='after' ? 1.4 : 0, sounded=-1;
    atriumBridge.visible=wave>0;
    updateBridge=dt=>{
      if(!state.bridgeSolid && state.phase!=='after'){wave=0;atriumBridge.visible=false;sounded=-1;return;}
      if(wave>=1.4)return;
      atriumBridge.visible=true;wave=Math.min(1.4,wave+(motion.reduced()?1.4:dt));
      parts.forEach(({g,base},i)=>{
        const t=Math.max(0,Math.min(1,(wave-i*.09)/.48)),ease=t*t*(3-2*t);
        g.visible=t>0;g.position.y=base-(1-ease)*1.7;g.rotation.z=(1-ease)*.075*(i%2?1:-1);
        if(t>0 && i%3===0 && i>sounded){sounded=i;audio.playInteraction('harmonic',i/3);}
      });
    };

    // East Wing: Pedestals + GLB models + Backstage Webpage Terminal
    const pedGeom = new THREE.CylinderGeometry(0.55, 0.65, 1.0, 16);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0xc7c8b9, roughness: .82 });
    const ped1 = new THREE.Mesh(pedGeom, pedMat);
    ped1.position.set(8.8, 0.5, -1.8);
    const ped2 = new THREE.Mesh(pedGeom, pedMat);
    ped2.position.set(8.8, 0.5, 1.8);
    scene.add(building.solid(ped1), building.solid(ped2));

    void loadGLB('/assets/p34/models/paper-prism-lamp.glb').then(model => {
      if (disposed || version !== buildId || currentLayerId !== 'atrium') return;
      model.position.set(8.8, 1.05, -1.8);
      model.userData.movingSolid=true;
      model.traverse(part=>{if(part.isMesh)building.solid(part);});
      scene.add(model);building.physics.add(model);
      animatedObjects.push(dt => { model.rotation.y += dt * 0.85; });
    });

    void loadGLB('/assets/p34/models/spatial-tuning-fork.glb').then(model => {
      if (disposed || version !== buildId || currentLayerId !== 'atrium') return;
      model.position.set(8.8, 1.05, 1.8);
      model.userData.movingSolid=true;
      model.traverse(part=>{if(part.isMesh)building.solid(part);});
      scene.add(model);building.physics.add(model);
      animatedObjects.push(dt => { model.rotation.y -= dt * 0.6; });
    });

    const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.7, 2.2), new THREE.MeshStandardMaterial({ color: 0x28323b, roughness: 0.8 }));
    terminal.position.set(11.4, 1.1, 0);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), new THREE.MeshBasicMaterial({ color: 0x9eabb2 }));
    screen.rotation.y = -Math.PI / 2;
    screen.position.set(11.2, 1.5, 0);
    scene.add(building.solid(terminal), screen);
    garden = addAtriumGarden(THREE, scene, renderer, building, { reduced: motion.reduced, software, getPlayer: () => player, onShift:()=>audio.playInteraction('shelf'), onNotice: () => { if (!isSilenced(state,currentLayerId)) onGardenComment?.(LINES.garden.moved[0]); } });
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
      if (object.isMesh && !object.isInstancedMesh) {
        const lit = (object.material.isMeshStandardMaterial || object.material.isMeshLambertMaterial) && object.material !== ceilingMat;
        object.receiveShadow = !object.userData.noReceiveShadow && lit;
        object.castShadow = !object.userData.noShadow && lit && !object.material.transparent;
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

    building = createBuilding(THREE, scene, renderer, { tone: 'stacks', software });
    const { box, floor: floorMat, wood: timber, metal, plaster } = building;
    for(const s of config.surfaces.filter(s=>s.id.startsWith('index-')||s.id.endsWith('-gallery')||s.id==='stack-entry-loggia')){
      box(s.maxX-s.minX,.46,s.maxZ-s.minZ,(s.maxX+s.minX)/2,s.yStart-.23,(s.maxZ+s.minZ)/2,floorMat);
    }
    for(let j=0;j<18;j++){
      const tread=5.1/18;
      box(17.8,.23,tread,0,(j+.5)*3.55/18-.115,10.3+(j+.5)*tread,plaster);
    }
    for(const x of [-4.15,4.15]){
      building.arch(x,-14,6.85,3.38,11.6,.37,.51,0,building.paint);
      for (const y of [-4,-8,-12]) {
        box(4.05,.24,1,x,y,4.2,building.paint);
        box(.18,4,.3,x-1.78,y-2,4.2,metal);
      }
    }

    stacksVista(THREE,scene,building);
    // The reading floor is an island over the shaft, with a deep visible cut below its lip.

    for(const side of [-1,1]){
      box(8.7,.56,.52,side*7.45,.28,-7.35,plaster);
      box(8.9,.11,.68,side*7.45,.61,-7.35,building.edge);
      building.column(.82,5.1,.82,side*8.7,0,10.3);
    }
    building.arch(-11.35,0,.8,3.3,2.2,.41,.6,Math.PI/2,building.paint);
    // Towering Archive Bookstacks + Instanced Books ascending into upper mist
    const spineMat = new THREE.MeshStandardMaterial({ color: 0xa6a394, roughness: .95 });
    for (let i = 0; i < 6; i++) {
      const z = -6.0 + i * 2.8;
      for (const side of [-1, 1]) {
        if (side < 0 && Math.abs(z-.8)<2) continue;
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
      if (side < 0 && Math.abs(z-.8)<2) continue;
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
    building.solid(stackBooks);
    stackBooks.count = bIdx;
    scene.add(stackBooks);

    // Sovereign Girl's sliding bookshelf (full framed rack with books)
    const shelfGroup = new THREE.Group();
    shelfGroup.rotation.y=Math.PI/2; shelfGroup.position.set(-6.72,0,state.shelfMoved ? 3.7 : 6.85);
    for (const y of [.12, 4.0]) building.slab(3.2, .24, .82, 0, y, 0, building.paint, shelfGroup);
    for (const sx of [-1.54, 1.54]) box(.12, 4.1, .8, sx, 2.05, 0, metal, shelfGroup);
    for (let row = 0; row < 5; row++) {
      box(3.05, .08, .76, 0, .42 + row * .86, 0, timber, shelfGroup);
      for (let b = 0; b < 11; b++) {
        if ((row + b) % 4 === 2) continue;
        box(.14, .42 + (b % 3) * .07, .55, -1.28 + b * .25, .67 + row * .86, 0, b % 2 ? spineMat : timber, shelfGroup);
      }
    }
    dynamicSlidingShelf = shelfGroup;
    shelfGroup.userData.movingSolid=true;shelfGroup.userData.solidId='sliding-shelf';
    scene.add(dynamicSlidingShelf);
    if (!state.shelfMoved) {
      let elapsed = 0;
      let playedSlideAudio = false;
      animatedObjects.push(dt => {
        if (!playedSlideAudio) { playedSlideAudio = true; audio.playInteraction('shelf'); }
        elapsed += dt;
        const p=Math.min(1,elapsed/1.6);
        dynamicSlidingShelf.position.z = 6.85 - 3.15*p*p*(3-2*p);
        if (elapsed >= 1.6 && !state.shelfMoved) {
          onShelfMoved?.();
          state = getState();
        }
      });
    }

    // West Blog Desk & East Relic Desk with legs, open books, and bound folios
    building.desk(-7.2, 0, 0.8, 2.0, 1.3, 1.1, timber, metal);
    building.desk(7.2, 0, 0.8, 2.0, 1.3, 1.1, timber, metal);

    // Optical Brass Overhead Projector on pedestal
    building.lathe([[0, 0], [.49, 0], [.49, .09], [.36, .18], [.26, .5], [.36, .69], [.42, .76], [0, .76]], 0, 0, -.8, plaster);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0x9d8a5e, roughness: .42, metalness: .62 });
    building.slab(.59, .22, .65, 0, .88, -.8, brassMat);
    building.arch(0, .96, -1.03, .46, .4, .049, .096, 0, brassMat);
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
      building.arch(x + .14, 1.13, .6, .45, .34, .025, .035, 0, brassMat);
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
      building.column(1.08, 2.46, 1.08, spec.x, 0, spec.z);
      const ringMat = new THREE.MeshStandardMaterial({
        color: spec.match ? 0xcfd6be : 0x9c8b61,
        emissive: spec.match ? 0x455948 : 0x1e1910,
        roughness: .4, metalness: .65,
      });

      const base = new THREE.Mesh(new THREE.CylinderGeometry(.58, .6, .14, 48), metal);
      base.position.y = .07; group.add(base);
      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(.56, .022, software ? 5 : 10, software ? 32 : 64), ringMat);
      outerRing.position.y = 2.95;
      outerRing.rotation.y = angleFor(spec.key, spec.val);
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(.46, .016, software ? 5 : 10, software ? 32 : 64), ringMat);
      innerRing.position.y = 2.95; innerRing.rotation.set(.48, angleFor(spec.key, spec.val) + .72, 0);
      const needle = new THREE.Mesh(new THREE.ConeGeometry(.055, .82, 4), ringMat);
      needle.position.y = 2.95;
      needle.rotation.y = angleFor(spec.key, spec.val);
      needle.rotation.z = -.55;
      group.add(outerRing, innerRing, needle);
      let angle=angleFor(spec.key,spec.val), velocity=0;
      animatedObjects.push(dt=>{
        const value=state.pillars[spec.key], goal=angleFor(spec.key,value),error=goal-angle;
        if(Math.abs(error)+Math.abs(velocity)<.001)return;
        // Critical damping preserves angular velocity through repeated turns.
        const fade=Math.exp(-7*dt),travel=(velocity-7*error)*dt;
        angle=goal+(-error+travel)*fade;velocity=(velocity-7*travel)*fade;
        outerRing.rotation.y=needle.rotation.y=angle;innerRing.rotation.y=angle+.72;
        ringMat.emissive.setHex(value===TARGET_PILLARS[spec.key]?0x455948:0x1e1910);
      });
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

    const viaduct = new THREE.Group();scene.add(viaduct);
    const rise=4.5,length=10.8,angle=Math.atan2(rise,length);
    const ramp=box(4.95,.29,Math.hypot(length,rise),0,rise/2-.15,-12.6,building.paint,viaduct);ramp.rotation.x=angle;
    for(const side of [-1,1]){
      const rail=box(.12,.12,Math.hypot(length,rise),side*2.37,rise/2+.85,-12.6,building.edge,viaduct);rail.rotation.x=angle;
      for(let i=0;i<=8;i++){const f=i/8;box(.095,.85,.095,side*2.37,.425+rise*f,-7.2-length*f,metal,viaduct);}
    }
    stacksViaduct=viaduct;viaduct.userData.movingSolid=true;viaduct.userData.solidId='north-bridge';
    viaduct.visible=state.stacksUnlocked || state.phase==='after';
    box(12,.64,7.5,0,4.18,-21.75,plaster);
    // Side rails hang below, rather than blocking the visual line across the abyss.
    for(const x of [-5.65,5.65]) building.arch(x,-6,-21.75,6.7,7.2,.62,.75,Math.PI/2);
    building.arch(0,4.5,-24.3,3.5,2.6,.47,.8);
    building.arch(0,3.55,17.45,3.45,2.3,.47,.72);
    box(23,.26,1.5,0,6.45,-16.4,building.paint);
    for(const x of [-10.4,10.4])building.arch(x,-7,-16.4,2.7,12,.32,.65,Math.PI/2);

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
    scene.background = new THREE.Color(0x788f99);
    scene.fog = new THREE.Fog(0x9fbbb7, 23, 160);
    scene.add(new THREE.HemisphereLight(0xe4e7df, 0x575b59, 1.25));
    const daylight = new THREE.DirectionalLight(0xe4e8e0, 1.1);
    daylight.position.set(9, 10, -8); scene.add(daylight);
    building = createBuilding(THREE, scene, renderer, { tone: 'library', software });
    const { box, plaster, wood: timber } = building;
    box(23,.25,28,0,-.125,-2,building.floor);
    for(let j=0;j<12;j++)box(6,.15,.5,0,j*.15+.075,-16.25-j*.5,building.floor);
    libraryVista(THREE,scene,building);
    for (const side of [-1, 1]) {
      for (const z of [-14, -4, 6]) {
        box(1.8, .12, 6, side * 8.4, .1, z, timber);
        box(.14, 6.8, 6, side * 8.4, 3.4, z, timber);
        for (const end of [-3, 3]) box(1.8, 6.8, .12, side * 8.4, 3.4, z + end, timber);
        for (let row = 1; row <= 7; row++) {
          box(1.8, .09, 6, side * 8.4, row * .85, z, timber);
        }
      }
      for (const z of [-9, 1]) {
        building.column(.8, 3.62, .8, side * 3.2, 0, z);
        building.arch(side * 6.46, 3.57, z, 5.85, .03, .48, .54);
      }
    }
    for (const z of [1, -9]) {
      building.arch(0, 3.57, z, 5.62, .03, .56, .67);
      building.arch(0, 3.6, z + .36, 5.73, .03, .12, .1, 0, building.edge);
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
    building.solid(books);
    books.count = bookIndex; scene.add(books);
    for(const z of [-9,1]){
      const pool=new THREE.PointLight(0xffe2bc,14,11);pool.position.set(0,4.5,z);scene.add(pool);
    }
    building.arch(0,0,10.7,3.3,2.9,.37,.52);
    residents=addResidents(THREE,scene,config,()=>player,motion.reduced,{layerId:'library'});
    animatedObjects.push(dt=>residents.update(dt));
    for (const target of config.interactables.filter(i => i.kind === 'book')) {
      building.desk(target.x, 0, target.z, 1.6, 1.02, 1.08, building.edge, timber);
    }
  }

  function populateLoft() {
    const version = buildId;
    scene.background = new THREE.Color(0x2a292b);
    scene.fog = new THREE.Fog(0x8397aa, 28, 185);

    const hemi = new THREE.HemisphereLight(0xe6dccb, 0x615950, 1.4);
    scene.add(hemi);

    const warmLamp = new THREE.PointLight(0xf3cc94, 27, 15);
    warmLamp.position.set(0.3, 3.1, -1.4);
    const windowLight = new THREE.PointLight(0x88b8cc, 10, 14);
    windowLight.position.set(0, 2.8, -6.2);
    scene.add(warmLamp, windowLight);

    building = createBuilding(THREE, scene, renderer, { tone: 'loft', software });
    const { box, floor: floorMat, wood: timber, metal, plaster } = building;
    box(16.4,.35,17.4,0,-.175,.5,floorMat);
    for(const x of [-9.75,9.75])box(3.5,.45,10.2,x,-.225,0,floorMat);
    for(let i=0;i<10;i++)box(5.6,.15,.45,0,.075+i*.15,-5.625-i*.45,building.plaster);
    box(13.6,.35,2,0,1.325,-10.9,floorMat);
    for(const x of [-5.25,5.25])box(3.2,.48,.28,x,1.74,-11.68,building.paint);
    loftVista(THREE,scene,building);
    const moon = new THREE.DirectionalLight(0xb7cced,1.1);moon.position.set(-15,14,-8);scene.add(moon);
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
    building.slab(1.15, .18, 3.18, -7.1, .18, 1.1, timber);
    building.slab(1.12, .27, 3, -7.1, .38, 1.1, linen);
    building.slab(.24, .58, 3, -7.56, .64, 1.1, linen);
    for (const z of [-.3, 2.5]) box(1.12, .38, .18, -7.1, .61, z, linen);
    const pillow = building.slab(.5, .13, .55, -7.1, .553, .2, linen); pillow.rotation.y = .2;
    building.slab(.44, .07, .44, -7.18, .035, -1.25, brass);
    const lampArm = new THREE.CatmullRomCurve3([[-7.18,.06,-1.25],[-7.18,1.5,-1.25],[-7.13,2.26,-1.25],[-6.9,2.46,-1.25],[-6.62,2.32,-1.25]].map(p => new THREE.Vector3(...p)));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(lampArm, 30, .025, 10), brass));
    const readingShade = new THREE.Mesh(new THREE.ConeGeometry(.32, .35, 40, 1, true), linen);
    readingShade.position.set(-6.62, 2.24, -1.25); scene.add(readingShade);
    const readingLight = new THREE.PointLight(0xf4d3a1, 7, 5.5); readingLight.position.set(-6.62, 2.06, -1.25); scene.add(readingLight);
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
    // The pendant hangs from an actual radial support, not an invisible ceiling.
    box(.65,.035,.045,1.05,2.12,-1.8,brass);
    box(.045,1.18,.045,1.35,1.55,-1.8,brass);
    building.lathe([[.18,0],[.19,.035],[.15,.08],[.03,.14],[0,.14]],.76,1.99,-1.8,brass);
    // Her Draftsman Workbench + Floating Sovereign Architectural Maquette
    building.desk(0, 0, -1.4, 2.8, 1.4, 0.96, timber, metal);
    building.desk(4.2, 0, 3.4, 1.5, 1.0, 0.9, timber, metal);
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xcfc9b8, roughness: .95, side: THREE.DoubleSide });
    for (const [sx, sz, rot] of [[-.82, -1.3, .22], [-.55, -1.65, -.14], [.45, -1.15, .38]]) {
      const slip = box(.38, .015, .28, sx, .97, sz, paperMat);
      slip.rotation.y = rot;
    }

    // The shared study always stands on the bench, including after a return visit.
    const wire = new THREE.MeshStandardMaterial({color:0xffe8b4,emissive:0xdd9859,emissiveIntensity:.48,metalness:.28,roughness:.36});
    sculpture = new THREE.Group(); sculpture.position.set(0,.995,-1.37);scene.add(sculpture);
    building.slab(1.32,.057,.68,0,.002,0,brass,sculpture);
    for(const z of [-.21,.21]) building.arch(0,.03,z,.96,.52,.09,.1,0,wire,sculpture);
    for(const x of [-.53,.53])building.slab(.19,.1,.63,x,.055,0,metal,sculpture);
    previewSculpture(state.sculpture ?? {height:1,span:1,tone:1},false);
    void loadGLB('/assets/p34/models/paper-prism-lamp.glb').then(model => {
      if (disposed || version !== buildId || currentLayerId !== 'loft') return;
      model.position.set(0.95, 0.98, -1.4);
      model.scale.setScalar(0.75);
      model.userData.movingSolid=true;
      model.traverse(part=>{if(part.isMesh)building.solid(part);});
      scene.add(model);building.physics.add(model);
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
        const spare = new THREE.Group(); spare.position.set(-7.4, .7, -2.97); spare.rotation.set(0, .28, 0);
        box(1.1, 1.4, .06, 0, 0, 0, timber, spare);
        const spareDrawing = new THREE.Mesh(new THREE.PlaneGeometry(.98, 1.28), sketchMat); spareDrawing.position.z = .035;
        spare.add(spareDrawing); scene.add(spare);
        box(.86,.86,.46,-7.5,.43,-3.27,timber);
      }
    }

    // A single pane retains the rainy recording; the rest of the dome is open.
    building.arch(3.4,0,-7.25,2.35,1.3,.16,.22,0,building.paint);
    box(.08,2.28,.08,3.4,1.14,-7.25,brass);
    for(const y of [.6,1.35])box(2.32,.055,.09,3.4,y,-7.25,brass);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.32,2.05),new THREE.MeshStandardMaterial({color:0xb9cfce,roughness:.22,metalness:.18,transparent:true,opacity:.17,depthWrite:false}));
    pane.position.set(3.4,1.04,-7.26);scene.add(pane);
    for(const door of config.interactables.filter(i=>i.crossing))building.arch(door.x,0,door.z,3.1,2.4,.41,.49,0,building.paint);
    garden = addLoftGarden(THREE, scene, building);
    residents = addResidents(THREE, scene, config, () => player, motion.reduced, {
      layerId: 'loft',
      isDialogueOpen: () => Boolean(conversation),
    });
    animatedObjects.push(dt => residents.update(dt));
  }

  function previewSculpture(shape, sound = true) {
    sculpture.scale.set(.72+shape.span*.29,.76+shape.height*.42,1);
    const light = sculpture.children[1].material;
    light.color.setHex([0xe8bc80,0xc9e6d9,0xce9f78][shape.tone]);
    if (sound && sculptureTone !== undefined && sculptureTone !== shape.tone) audio.playInteraction('harmonic',shape.tone);
    sculptureTone=shape.tone;
  }

  function rebuildLayerScene() {
    clearScene();
    state = getState();
    config = worldConfig();
    scene.environmentIntensity = .68;
    if (renderer) renderer.toneMappingExposure = 1.05;
    if (library) populateLibrary();
    else if (currentLayerId === 'atrium') populateAtrium();
    else if (currentLayerId === 'stacks') populateStacks();
    else if (currentLayerId === 'loft') populateLoft();
    else {
      building=createBuilding(THREE,scene,renderer,{tone:currentLayerId,software});
      deepRoom=populateDeep({ THREE,scene,renderer,software,layer:currentLayerId,state,config,building,reduced:motion.reduced });
      residents=addResidents(THREE,scene,config,()=>player,motion.reduced,{layerId:currentLayerId,isDialogueOpen:()=>Boolean(conversation)});
      deepRoom.update(0,player);
      animatedObjects.push(dt=>{ deepRoom.update(dt,player); residents.update(dt); });
    }
    // Resting books belong to their desks, not the camera or an overlay.
    for(const target of config.interactables){
      const catalogue=target.kind==='garden-specimen' && target.specimen==='folio';
      if(!catalogue && !['book','blog-desk','clue','pool-study','draft-note','loft-daily-note'].includes(target.kind))continue;
      let {x,z}=target,y;
      if(catalogue)y=1.622;
      else if(target.kind==='book')y=1.081;
      else if(target.kind==='blog-desk' || target.clueId==='retired-relic')y=1.101;
      else if(target.kind==='pool-study')y=2.8;
      else if(target.kind==='draft-note')y=.985;
      else if(target.kind==='loft-daily-note')y=.913;
      else if(target.clueId==='atrium-survey')y=5.101;
      else{
        z+=.56;y=1.055;
        building.desk(x,0,z,1.46,.96,y,building.wood,building.metal);
      }
      const rig=makeBook(THREE,x-.12,y,z,target.label,bookRigs.size);
      scene.add(rig.root);bookRigs.set(target.id,rig);
    }
    const silent = isSilenced(state,currentLayerId);
    audio.setLayer(silent ? 'closed' : currentLayerId);
    applyGardenPreferences();
    if (state.phase==='after') {
      const glow=new THREE.HemisphereLight(0xffd8a5,0xb88977,.81);scene.add(glow);
      scene.fog.color.lerp(new THREE.Color(0xffdbb9),.22);
    }
    if (silent) {
      scene.fog.color.lerp(new THREE.Color(0x76848c),.78);
      if(scene.fog.isFogExp2)scene.fog.density*=1.13;
      const trace=config.interactables.find(i=>i.kind==='memory-trace' && !state.traces.includes(currentLayerId));
      if(trace){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.43,.027,8,52),new THREE.MeshStandardMaterial({color:0xf1e8d0,emissive:0xe8e8e0,emissiveIntensity:.9}));
        ring.rotation.x=Math.PI/2;ring.position.set(trace.x, trace.y+.04, trace.z);scene.add(ring);
        animatedObjects.push(()=>{const near=Math.hypot(player.x-trace.x,player.z-trace.z)<7;if(near&&!echoHeard){echoHeard=true;audio.playInteraction('harmonic',state.garden.chime ?? 0);}});
      }
    }
    if (!deepRoom) dome=skyDome(THREE,scene,silent?0x4f5960:({library:0x687f94,loft:0x1c2948,atrium:GARDEN_LIGHT[appliedSky || 'morning'].sky,stacks:0x253952}[currentLayerId]));
    scene.background.copy(scene.fog.color);
    play=createPlayroom({THREE,scene,camera,config,state,readState:()=>state,building,audio,say:remark,memory:playMemory,reduced:motion.reduced});
    config.physics=building.physics;
    building.bakeMasonry();
    updateSize();
    if (!reading) syncCamera();
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
        const { hemi, dir, centerLight } = gardenLighting;
        hemi.color.setHex(mood.sky); hemi.groundColor.setHex(mood.ground);
        hemi.intensity = mood.hemi * (currentLayerId === 'stacks' ? .95 : 1);
        dir.color.setHex(mood.sun); dir.position.set(...mood.position);
        dir.intensity = mood.direct * (currentLayerId === 'stacks' ? .3 : 1);
        if (dir.castShadow) dir.shadow.needsUpdate = true;
        scene.fog.color.setHex(mood.fog);
        if (currentLayerId === 'stacks') scene.fog.color.lerp(new THREE.Color(0x34495e), .79);
        scene.fog.near = currentLayerId === 'stacks' ? 21 : 27; scene.fog.far = 161;
        scene.background.copy(scene.fog.color);
        if(dome) dome.uniforms.zenith.value.setHex(currentLayerId==='stacks' ? 0x253952 : mood.sky);
        if (centerLight) { centerLight.color.setHex(mood.glow); centerLight.intensity = mood.pool; }
        scene.environmentIntensity = sky === 'midnight' ? .18 : .72;
        if (renderer) renderer.toneMappingExposure = sky === 'midnight' ? .82 : sky === 'dusk' ? .94 : 1.08;
        hemi.intensity = sky === 'midnight' ? .76 : mood.hemi;
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
    if(presentation.active) return;
    const bob = player.grounded ? Math.sin(bobPhase)*.028*Math.min(1,Math.hypot(player.vx,player.vz)/4) : 0;
    camera.position.set(player.x, player.y + EYE_HEIGHT + (motion.reduced()?0:bob-player.dip+player.stairOffset), player.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }

  function updateTargetPrompt() {
    if (reading || !modal.hidden || conversation) {
      promptBox.hidden = true;
      activeTarget = null;
      if (touchInteractBtn) { touchInteractBtn.dataset.active = 'false'; touchInteractBtn.textContent = '环视'; }
      return;
    }
    activeTarget = play?.target(player) || findInteractiveTarget(player, player.yaw, player.pitch, config.interactables);
    reticle.dataset.active = String(Boolean(activeTarget));
    if (activeTarget) {
      promptBox.hidden = false;
      promptTitle.textContent = activeTarget.label;
      promptBtn.textContent = matchMedia('(pointer: coarse)').matches ? activeTarget.prompt.replace(/^E\s*·\s*/, '') : activeTarget.prompt;
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

  let restoreModalContent;
  function projectFold() {
    const nodes=getLightNodes();
    if (nodes === foldPoints && foldPoints.every((n,i)=>foldKnobs[i].position.x===(n[0]-.5)*2.7 && foldKnobs[i].position.y===(1-n[1])*1.25+.03)) return;
    foldPoints=nodes;
    const local=([x,y])=>new THREE.Vector3((x-.5)*2.7,(1-y)*1.25+.03,.027);
    nodes.forEach((n,i)=>foldKnobs[i].position.copy(local(n)));
    const curve=new THREE.CatmullRomCurve3(Array.from({length:19},(_,i)=>local(lightPoint(nodes,i/18))));
    foldProfile.geometry.dispose();foldProfile.geometry=new THREE.TubeGeometry(curve,36,.016,6,false);
  }

  function openFoldDesk() {
    if(isSilenced(getState(),currentLayerId)) return;
    openInspectorModal('折页台', body=>{
      const restore=mountFoldDesk(body);
      foldModel.visible=true; projectFold();
      return ()=>{foldModel.visible=false;restore();};
    }, 'fold');
    presentation.focus('fold',new THREE.Vector3(FOLD_DESK.x+.65,2.07,FOLD_DESK.z+3.3),new THREE.Vector3(FOLD_DESK.x,1.57,FOLD_DESK.z-.25));
  }

  function openInspectorModal(title, renderContent, kind = '',target=null) {
    keys.clear(); draggingLook = false; lookPointerId = null;
    resetTouchStick();
    modal.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (kind) modalCard.dataset.modalKind = kind;
    else delete modalCard.dataset.modalKind;
    modalTitle.textContent = title;
    modalBody.replaceChildren();
    restoreModalContent = renderContent(modalBody);
    modal.hidden = false;
    updateTargetPrompt();
    if(target && bookRigs.has(target.id)){
      modal.classList.add('world3d-bound-sheet');modal.dataset.focusPage='true';
      mountSpread(target,modal);
    }else modalClose.focus({ preventScroll: true });
  }

  function closeModal(after) {
    if (modal.hidden) return false;
    const finish=()=>{
      if(modal.classList.contains('world3d-bound-sheet')){
        modal.classList.remove('world3d-bound-sheet');root.append(modal);
        modal.removeAttribute('style');modal.inert=false;
      }
      restoreModalContent?.();restoreModalContent=null;modal.hidden=true;
      updateTargetPrompt();viewport.focus({preventScroll:true});
      if(typeof after==='function')after();
    };
    if(presentation.mode==='return')return true;
    if(readingObject?.element===modal)putBack(finish);
    else if(['fold','cocreate'].includes(presentation.mode)){modal.dataset.returning='true';presentation.close(()=>{delete modal.dataset.returning;finish();});}
    else finish();
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
    if(presentation.active || player.rescue) return false;
    if(play?.interact(target,player)){help.dataset.dismissed='true'; updateTargetPrompt();return true;}
    if (!target) return false;
    help.dataset.dismissed='true';
    state = getState();

    if (target.kind === 'cocreate') {
      openInspectorModal('共创台',body=>mountCreationDesk(body,previewSculpture,closeModal),'cocreate');
      presentation.focus('cocreate',new THREE.Vector3(.18,1.81,1.03),new THREE.Vector3(.26,1.49,-1.35));
      return true;
    }
    if (target.kind==='draft-note' || target.kind==='pool-study'){
      onInteract(target.kind,target);
      openInspectorModal(target.label,body=>{
        const p=document.createElement('p');p.textContent=target.kind==='draft-note'?LINES.drafts.note:LINES.poolrooms.study;body.append(p);
      },'clue',target);
      return true;
    }
    if (['pool-echo','prototype','memory-trace'].includes(target.kind)){
      audio.playInteraction(target.kind==='memory-trace'?'harmonic':'paper',1);
      onInteract(target.kind,target.kind==='memory-trace' ? currentLayerId : target);
      return true;
    }
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
      }, 'clue',target);
      return true;
    }

    if (target.kind === 'talk-arrival') {
      residents.triggerArrivalDissolve(true);
      onInteract?.('talk-arrival', target);
      updateTargetPrompt();
      return true;
    }

    if (target.kind === 'book') { library.onRead(target.slug); return true; }
    if (target.kind === 'library-exit') { audio.playInteraction('portal'); travel(()=>onOpenRoom('home')); return true; }

    if (target.kind === 'seam') {
      audio.playInteraction('portal');
      onLeaveSite?.();
      return true;
    }

    if (target.kind === 'lab-link') {
      audio.playInteraction('paper');
      onInteract?.('lab-link', target);
      openFoldDesk();
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
        mk('去折页台', openFoldDesk);
        mk('去笔记', () => onOpenRoom?.('blog'));
        mk('离开终端', () => viewport.focus({ preventScroll: true }));
        body.append(pre, links);
      }, 'terminal');
      return true;
    }

    if (target.kind === 'blog-desk') {
      openInspectorModal('这个弯留着',body=>{
        for(const text of ['中间两点抬起来，桥面就有地方落了','试过拉平','看着不舒服，又撤回去了','这个弯先留着']){
          const p=document.createElement('p');p.textContent=text;body.append(p);
        }
        const next=document.createElement('button');next.type='button';next.dataset.libraryContinue='';
        next.textContent='去阅览室';next.addEventListener('click',()=>closeModal(()=>travel(()=>onOpenRoom('blog'))));body.append(next);
      },'clue',target);
      return true;
    }
    if (target.kind === 'gallery-door') {
      audio.playInteraction('portal');travel(()=>onOpenRoom('blog'));
      return true;
    }

    if (target.kind === 'projector') {
      if (state.diagram) {
        audio.playInteraction('unlock');
        onInteract?.('sync-pillars', target);
        state = getState();
        stacksViaduct.visible=state.stacksUnlocked || state.phase==='after';
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
      audio.playInteraction('armillary');
      if(!wasUnlocked && state.stacksUnlocked)audio.playInteraction('unlock');
      stacksViaduct.visible=state.stacksUnlocked || state.phase==='after';
      return true;
    }

    if (target.kind === 'portal') {
      const dest = target.targetLayer;
      if (!canEnterLayer(state,dest)) {
        audio.playInteraction('pillar');
        onInteract?.('portal-locked-loft', target);
        return false;
      }
      audio.playInteraction('portal');
      switchLayer(dest, { source: target.id });
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
        }, 'clue',target);
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

  function switchLayer(nextLayer, { push = true, source } = {}) {
    if (!LAYERS.includes(nextLayer)) return false;
    state = getState();
    if (!canEnterLayer(state,nextLayer)) {
      onInteract?.('portal-locked-loft');
      return false;
    }
    closeModal();
    travel(()=>{
      currentLayerId = nextLayer;
      onLayerChange?.(nextLayer, { push });
      state = getState();
      config = getLayerConfig(currentLayerId, state);
      player = createBody(layerEntrySpawn(config, source));
      rebuildLayerScene();
    });
    return true;
  }

  function stepSurfaceKind(x, z, y) {
    if (currentLayerId === 'poolrooms' && y < -.55) return 'water';
    if (currentLayerId === 'atrium' && inPool(x, z, y)) return 'water';
    if ((currentLayerId === 'atrium' && z < -10.0 && y > 3.1) || (currentLayerId === 'stacks' && z < -7.4)) return 'bridge';
    if (library || currentLayerId === 'loft' || (currentLayerId === 'atrium' && x > 18 && y > 1.8)) return 'wood';
    return 'tile';
  }

  function crossArchitecture(before,next) {
    const wing=wrapWing(before,next,config);
    if (wing) {
      wingLoops++; wingIndex.rotation.y=wingLoops*Math.PI/2;
      if(isSilenced(state,currentLayerId))audio.playInteraction('harmonic',0);
      return wing;
    }
    return deepCrossing(currentLayerId,before,next) || next;
  }

  function stepMovement(dt) {
    if (keys.size || touchStick.analog) help.dataset.dismissed='true';
    let forward=Number(keys.has('KeyW') || keys.has('ArrowUp'))-Number(keys.has('KeyS') || keys.has('ArrowDown'));
    let strafe=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    if(touchStick.analog){ forward-=touchStick.dy; strafe+=touchStick.dx; }
    player.yaw+=((keys.has('ArrowLeft')||keys.has('KeyQ')?1:0)-(keys.has('ArrowRight')||keys.has('KeyR')?1:0))*dt*1.12;
    const sprinting=keys.has('ShiftLeft') || keys.has('ShiftRight') || (touchStick.analog && Math.hypot(forward,strafe)>.85);
    const v=(sprinting?6.8:4.9)/Math.max(1,Math.hypot(forward,strafe));
    const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw),before={x:player.x,y:player.y,z:player.z};
    const e=advanceBody(player,building.physics,(-sin*forward+cos*strafe)*v,(-cos*forward-sin*strafe)*v,dt);
    if(e.catch)play.catchStart(player);
    if(e.rescued)play.catchEnd();
    const region=stepSurfaceKind(player.x,player.z,player.y), surface=player.footing?.material;
    const material=surface==='glass'||surface==='wood'?surface:region;
    if(e.landed) play.land(player,material,e.landed);
    if(player.grounded){
      const moved=Math.hypot(player.x-before.x,player.z-before.z);
      bobPhase+=moved*3.6;stepDistance+=moved;
      if(stepDistance>=1.72){stepDistance%=1.72;play.step(player,material,sprinting);if(currentLayerId==='atrium')garden.ripple(player.x,player.z);}
    }
    if(!player.rescue){
      const pose=crossArchitecture(before,player);
      if(pose!==player){ const dz=pose.z-player.z;player.z=pose.z;player.safe.z+=dz; }
      const door=crossedDoor(before,player,config.interactables);
      if(door){keys.clear();resetTouchStick();triggerInteraction(door);return true;}
    }
    if(nudgeTime>0 && (nudgeTime-=dt)<=0)keys.delete(nudgeCode);
    return false;
  }

  function canRoam(){return active && modal.hidden && !reading && !presentation.active && !shellBlocked();}
  function jump(){if(canRoam() && !player.rescue){queueJump(player);help.dataset.dismissed='true';}}
  function guide(){if(canRoam()){play.guide(player);help.dataset.dismissed='true';}}
  function nudgeMove(dir){
    if(!canRoam())return;
    nudgeCode={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'}[dir];
    keys.add(nudgeCode);nudgeTime=.1;
  }

  // Event Listeners
  const listen = (el, type, fn, opts) => el.addEventListener(type, fn, { signal, ...opts });

  listen(window, 'resize', updateSize);
  listen(root.querySelector('[data-guide]'),'click',guide);
  listen(root.querySelector('[data-jump]'),'click',jump);
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

  listen(inspectorBtn, 'click', () => { if (modal.hidden) openSpatialOverviewModal(); });
  listen(modalClose, 'click', closeModal);
  listen(promptBox, 'click', e => {
    e.stopPropagation();
    if (activeTarget && !activeTarget.crossing) triggerInteraction(activeTarget);
  });

  listen(viewport, 'pointerdown', e => {
    if (presentation.active || reading || !modal.hidden || pointerLocked || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
    if(presentation.active) return;
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
    if (e.repeat || presentation.active) return;
    if(e.code==='Space' && !e.target.closest?.('button,a[href]')){e.preventDefault();jump();return;}
    if(e.code==='KeyG'){e.preventDefault();guide();return;}
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyR'].includes(e.code)) {
      keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      if (!activeTarget?.crossing) triggerInteraction(activeTarget);
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
    if (canRoam()) {
      for(const fn of animatedObjects)fn(rawDt);
      building.physics.update();
      accumulator+=rawDt;
      while(accumulator>=TICK){accumulator-=TICK;if(stepMovement(TICK)){accumulator=0;break;}}
      syncCamera();play.update(rawDt,player);updateTargetPrompt();
      audio.updateSpatial(player, isSilenced(state,currentLayerId) ? 'closed' : currentLayerId, residents?.snapshot(), rawDt);
    } else accumulator=0;
    updatePresentation(rawDt);
    if(asideTime>0 && (asideTime-=rawDt)<=0)delete aside.dataset.visible;
    if(foldModel?.visible)projectFold();
    if (renderer) renderer.render(scene, camera);
    if (renderer && typography) {
      renderer.clearDepth(); renderer.autoClear = false;
      typography.render(renderer, rawDt);
      renderer.autoClear = true;
    }
    rafId = requestAnimationFrame(animate);
  }

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
    openFoldDesk,
    refreshBridge() {
      state = getState();
      if (currentLayerId !== 'atrium') return;
      updateBridge(0);
      if ((state.bridgeSolid || state.phase==='after') && foldModel?.visible) {
        presentation.focus('fold',new THREE.Vector3(FOLD_DESK.x+.9,2.18,FOLD_DESK.z+3.4),new THREE.Vector3(-1.8,2.93,-11.6));
      }
      updateTargetPrompt();
    },
    readBook,
    setDialogue,
    getLayer: () => currentLayerId,
    getPresentation:()=>({mode:presentation.mode,moving:presentation.moving,book:readingObject?.name ?? null,
      openness:presentation.amount,cover:presentation.book?.coverPivot.rotation.z ?? 0,
      ink:readingObject?Number(readingObject.element.style.opacity):0,eye:camera.position.toArray(),veil:Number(veil.style.opacity)}),
    hasSolidBridge: () => Boolean(atriumBridge?.visible),
    getPlayer: () => ({ ...player }),
    getResidents: () => residents?.snapshot() || null,
    getArchitecture: () => ({ play:play.snapshot(), wingLoops, wingReleased:Boolean(config.wingReleased), ...deepRoom?.snapshot(), calls: renderer?.info.render.calls, triangles:renderer?.info.render.triangles }),
    getGarden: () => ({ sky: appliedSky, chime: appliedChime, ...(garden?.snapshot?.() || {}) }),
    ringChime(tone) { garden.pluck(); audio.playInteraction('chime', tone); state = getState(); applyGardenPreferences(); },
    getActiveTarget: () => activeTarget,
    getInteractables: () => config.interactables.map(i => ({ ...i })),
    switchLayer: (l, opts) => switchLayer(l, opts),
    inspectGround(x,z,limit) {
      const floor=building.physics.support(x,z,limit,.34);
      return floor && {...floor,clear:!building.physics.blocked(x,z,floor.y+.012,1.72,.34)};
    },
    teleport(x, z, yaw = player.yaw, pitch = player.pitch, elevation = player.y) {
      const floor=building.physics.support(x,z,elevation+.48,0);
      player=createBody({x,y:floor?.y ?? elevation,z,yaw,pitch});
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
        player = createBody(config.spawn);
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
      environment?.dispose();
      renderer?.dispose();
      root.remove();
    },
  };

  container.__p34World = api;
  if (typeof window !== 'undefined') window.__p34World = api;
  signal?.addEventListener('abort', () => api.dispose(), { once: true });
  return api;
}
