export const JOURNEY_COOKIE = 'p34_journey_v2';
export const PHASES = ['arrive', 'shared', 'poolrooms', 'stacks', 'drafts', 'closed', 'loft', 'after'];
const LEGACY_PHASES = ['tuned', 'guided', 'choice', 'closed', 'found', 'making'];
export const LAYERS = ['atrium', 'poolrooms', 'stacks', 'drafts', 'loft'];
export const TRACES = ['atrium', 'poolrooms', 'drafts'];
export const RESPONSES = ['affirm', 'critique', 'reserve'];
export const GARDEN_SKIES = ['morning', 'afternoon', 'dusk', 'midnight'];
export const LAYER_LABELS = {
  atrium: '第一层 · 无尽回廊',
  poolrooms: '第二层 · 浸水泳池厅',
  stacks: '第三层 · 悬渊书库',
  drafts: '第四层 · 废弃草稿区',
  loft: '第五层 · 穹顶观测阁楼',
};
export const NOTES = ['rain-folder', 'long-way', 'landing-notes', 'tomorrow-again', 'pulling-light'];
export const CLUES = ['atrium-survey', 'retired-relic', 'slot-34-log', 'dual-handwriting', 'rain-origin-trace', 'pool-echo', 'pool-study', 'draft-note'];
export const IDENTITY_CLUES = ['slot-34-log', 'dual-handwriting', 'rain-origin-trace'];

export const CLUE_INFO = {
  'pool-echo': { title: '水面的第二道拱', layer: 'poolrooms', summary: '站到水下最低一级，拱顶会和倒影合成一圈。最初的图上只有半圈。' },
  'pool-study': { title: '两条水位线', layer: 'poolrooms', summary: '旧水线旁注着「坐着也看得见天」。新水线抬高两砖，补完了倒影，低处的座沿却没进水里。' },
  'draft-note': { title: '桥脚的铅笔印', layer: 'drafts', summary: '纸背记了七个尺寸。她把第六个圈起来，又在圈外写：「从上面好看。自己走过去试过没有？」' },
  'atrium-survey': {
    title: '测绘纸',
    layer: 'atrium',
    summary: '正面的平面图到这里就结束了。背面还有一笔，通向纸外。',
  },
  'retired-relic': {
    title: '收起来的草稿',
    layer: 'stacks',
    summary: '几张被翻过去的图纸。最上面写着：「这个先放着」。',
  },
  'slot-34-log': {
    title: '第 34 页',
    layer: 'loft',
    summary: '目录写着「空置」。背面的房间图已经改过很多次。署名那一栏始终空着。',
  },
  'dual-handwriting': {
    title: '另一种笔迹',
    layer: 'loft',
    summary: '正面写着「撤下入口」。背面是另一种笔迹：「入口撤了，房间又没消失」。',
  },
  'rain-origin-trace': {
    title: '窗边的记录',
    layer: 'loft',
    summary: '同一段雨，出现在两个网页的草稿里。其中一份没有作者，旁边写着：「这份是谁存的？」',
  },
};

export const PILLAR_OPTIONS = {
  west: [
    { id: 'void', label: '朝向深谷（下）' },
    { id: 'seam', label: '朝向正门页缝（北）' },
    { id: 'blind', label: '朝向盲区（西）' },
  ],
  center: [
    { id: 'ground', label: '底层标高 0.0m' },
    { id: 'mezzanine', label: '二层天桥 +3.2m' },
    { id: 'loft', label: '阁楼顶层 +6.4m' },
  ],
  east: [
    { id: 'noise', label: '空白底噪' },
    { id: 'roof', label: '铁皮棚顶雨声' },
    { id: 'rain', label: '雨夜倒车的窗沿' },
  ],
};

export const TARGET_PILLARS = {
  west: 'seam',
  center: 'mezzanine',
  east: 'rain',
};

const integer = (n, max = 65535) => Number.isInteger(n) && n >= 0 && n <= max;
const require = (value, message) => { if (!value) throw new Error(message); };
const sketchValid = nodes =>
  nodes === null ||
  (Array.isArray(nodes) &&
    nodes.length === 4 &&
    nodes.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1)));

const pillarsValid = p =>
  Boolean(
    p &&
      typeof p === 'object' &&
      PILLAR_OPTIONS.west.some(o => o.id === p.west) &&
      PILLAR_OPTIONS.center.some(o => o.id === p.center) &&
      PILLAR_OPTIONS.east.some(o => o.id === p.east)
  );

export function isBridgeArch(nodes) {
  if (!sketchValid(nodes) || nodes === null) return false;
  const midHigh = Math.max(nodes[1][1], nodes[2][1]) <= 0.42;
  const spanWide = Math.abs(nodes[3][0] - nodes[0][0]) >= 0.35;
  return midHigh && spanWide;
}

export function pillarsAligned(pillars) {
  return Boolean(
    pillars &&
      pillars.west === TARGET_PILLARS.west &&
      pillars.center === TARGET_PILLARS.center &&
      pillars.east === TARGET_PILLARS.east
  );
}

export function identityClueCount(state) {
  return IDENTITY_CLUES.filter(id => state.clues?.includes(id)).length;
}

export function blueprintSketch(offset) {
  const clamped = Math.max(-0.9, Math.min(0.9, Number(offset) || 0));
  const norm = (clamped + 0.9) / 1.8; // 0 .. 1
  const foldX = Math.round(220 + norm * 480);
  const apexY = Math.round(360 - norm * 195);
  const westEnd = `${Math.round(480 + norm * 380)} ${Math.round(280 - norm * 118)}`;
  const aligned = clamped >= 0.72;
  return {
    offset: clamped,
    foldX,
    apexY,
    seamPath: `M140 460 Q${foldX} ${apexY} 840 165`,
    rayPath: `M240 450 L${foldX} ${apexY} L${westEnd}`,
    pillarHeight: Math.round(90 + norm * 140),
    aligned,
  };
}

export function resolveCookieDomain(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'sayori.org' || h.endsWith('.sayori.org')) return '.sayori.org';
  if (h === 'sayori.local' || h.endsWith('.sayori.local')) return '.sayori.local';
  return '';
}

export function newJourney() {
  return {
    v: 2,
    phase: 'arrive',
    currentLayer: 'atrium',
    layers: ['atrium'],
    touched: false,
    light: 0,
    lightSketch: null,
    // Retained for old saves; the frame and walk-reset mechanic are retired.
    westAligned: false,
    loopCount: 0,
    bridgeSolid: false,
    shelfMoved: false,
    pillars: { west: 'void', center: 'ground', east: 'noise' },
    stacksUnlocked: false,
    opened: [],
    diagram: false,
    clues: [],
    leftLetter: false,
    garden: { sky: null, chime: null },
    response: null,
    traces: [],
    sculpture: null,
    legacyLoft: false,
  };
}

function normalizePhase(rawPhase, layers, oldArc) {
  if (rawPhase === 'closed' && oldArc) return layers?.includes('loft') ? 'loft' : layers?.includes('stacks') ? 'stacks' : 'shared';
  if (PHASES.includes(rawPhase)) return rawPhase;
  if (LEGACY_PHASES.includes(rawPhase)) {
    if (rawPhase === 'after') return 'after';
    if (layers?.includes('loft')) return 'loft';
    if (layers?.includes('stacks')) return 'stacks';
    return 'shared';
  }
  return null;
}

const validSculpture = value => value && ['height', 'span', 'tone'].every(key => integer(value[key], 2));
export function startingSculpture(state) {
  return state.sculpture || { height: 1, span: state.response === 'critique' ? 2 : 1, tone: state.garden.chime ?? 0 };
}
export function canEnterLayer(state, layer) {
  if (!LAYERS.includes(layer)) return false;
  if (layer === 'loft' && state.phase === 'closed' && state.response) return state.traces?.length === TRACES.length;
  if (state.phase === 'after' || state.layers?.includes(layer)) return true;
  if (layer === 'poolrooms') return Boolean(state.bridgeSolid || state.stacksUnlocked || state.layers?.includes('stacks'));
  if (layer === 'drafts') return Boolean(state.stacksUnlocked);
  if (layer === 'loft') return Boolean(state.legacyLoft || state.traces?.length === TRACES.length);
  return true; // The original stacks URL and the blog return door are public entrances.
}
export function isSilenced(state, layer) {
  return state.phase === 'closed' || (state.phase === 'loft' && Boolean(state.response) && layer !== 'loft');
}

export function readJourney(raw) {
  if (raw === null) return { state: newJourney(), error: '', migrated: false };
  try {
    require(typeof raw === 'string' && raw.length <= 3800 && encodeURIComponent(raw).length <= 3800, '存档过长');
    const s = JSON.parse(raw);
    if (s?.v === 1) {
      require(
        (PHASES.includes(s.phase) || LEGACY_PHASES.includes(s.phase)) &&
          [0, 1, 2].includes(s.light) &&
          sketchValid(s.lightSketch ?? null) &&
          typeof s.leftLetter === 'boolean',
        '旧存档格式有误'
      );
      const state = newJourney();
      state.phase = s.phase === 'arrive' ? 'arrive' : 'shared';
      state.touched = s.touched === true;
      state.light = s.light;
      state.lightSketch = s.lightSketch ?? null;
      state.bridgeSolid = s.light === 2 || isBridgeArch(state.lightSketch);
      state.leftLetter = s.leftLetter;
      return { state, error: '', migrated: true };
    }
    require(s?.v === 2, '存档版本不兼容');
    const oldArc = !Object.hasOwn(s, 'traces');
    const mappedPhase = normalizePhase(s.phase, s.layers, oldArc);
    require(mappedPhase !== null, '进度格式有误');
    require(typeof s.touched === 'boolean' && typeof s.leftLetter === 'boolean', '经历格式有误');
    require(typeof (s.diagram ?? false) === 'boolean', '图纸记录有误');
    require([0, 1, 2].includes(s.light) && sketchValid(s.lightSketch ?? null), '光稿格式有误');
    require(
      Array.isArray(s.opened) &&
        s.opened.length <= NOTES.length &&
        new Set(s.opened).size === s.opened.length &&
        s.opened.every(n => NOTES.includes(n)),
      '文章记录有误'
    );

    const layers = s.layers === undefined ? ['atrium'] : s.layers;
    require(
      Array.isArray(layers) &&
        layers.length >= 1 &&
        layers.length <= LAYERS.length &&
        layers[0] === 'atrium' &&
        new Set(layers).size === layers.length &&
        layers.every(l => LAYERS.includes(l)),
      '层级记录有误'
    );
    const currentLayer = s.currentLayer === undefined ? layers[layers.length - 1] : s.currentLayer;
    require(LAYERS.includes(currentLayer) && layers.includes(currentLayer), '当前层级有误');

    const westAligned = s.westAligned ?? false;
    const bridgeSolid = s.bridgeSolid ?? (s.light === 2 || isBridgeArch(s.lightSketch ?? null));
    const shelfMoved = s.shelfMoved ?? false;
    const loopCount = s.loopCount ?? 0;
    require(
      typeof westAligned === 'boolean' &&
        typeof bridgeSolid === 'boolean' &&
        typeof shelfMoved === 'boolean' &&
        integer(loopCount, 9999),
      '空间机关记录有误'
    );

    const pillars = s.pillars ?? { west: 'void', center: 'ground', east: 'noise' };
    require(pillarsValid(pillars), '空间基准柱记录有误');
    const stacksUnlocked = s.stacksUnlocked ?? pillarsAligned(pillars);
    require(typeof stacksUnlocked === 'boolean', '书库门锁记录有误');

    const clues = s.clues ?? [];
    require(
      Array.isArray(clues) &&
        clues.length <= CLUES.length &&
        new Set(clues).size === clues.length &&
        clues.every(c => CLUES.includes(c)),
      '线索档案有误'
    );

    const garden = s.garden ?? { sky: null, chime: null };
    require(garden && typeof garden === 'object' && !Array.isArray(garden) &&
      (garden.sky === null || GARDEN_SKIES.includes(garden.sky)) &&
      (garden.chime === null || [0, 1, 2].includes(garden.chime)), '庭院偏好有误');

    const normalized = {
      v: 2,
      phase: mappedPhase,
      currentLayer,
      layers: [...layers],
      touched: s.touched,
      light: s.light,
      lightSketch: s.lightSketch ?? null,
      westAligned,
      loopCount,
      bridgeSolid,
      shelfMoved,
      pillars: { ...pillars },
      stacksUnlocked,
      opened: [...s.opened],
      diagram: Boolean(s.diagram),
      clues: [...clues],
      leftLetter: s.leftLetter,
      garden: { sky: garden.sky, chime: garden.chime },
      response: s.response ?? null,
      traces: s.traces === undefined ? [] : s.traces,
      sculpture: s.sculpture ?? null,
      legacyLoft: s.legacyLoft ?? (oldArc && stacksUnlocked),
    };
    require(typeof normalized.legacyLoft === 'boolean' && (normalized.response === null || RESPONSES.includes(normalized.response)), '共游记录有误');
    require(Array.isArray(normalized.traces) && normalized.traces.length <= TRACES.length &&
      normalized.traces.every(id => TRACES.includes(id)) && new Set(normalized.traces).size === normalized.traces.length, '回声记录有误');
    require(normalized.sculpture === null || validSculpture(normalized.sculpture), '共创模型有误');
    require(normalized.phase !== 'closed' || normalized.response !== null, '封闭记录有误');
    require(encodeURIComponent(JSON.stringify(normalized)).length <= 3800, '存档超出浏览器容量');
    return { state: normalized, error: '', migrated: oldArc && LEGACY_PHASES.includes(s.phase) };
  } catch (e) {
    return {
      state: newJourney(),
      error: `原存档保留：${e instanceof SyntaxError ? '文件格式有误' : e.message}`,
      migrated: false,
    };
  }
}

export function cookieJourney(cookies = '') {
  const rows = String(cookies)
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
  const row = rows.find(s => s.startsWith(JOURNEY_COOKIE + '=')) || rows.find(s => s.startsWith('p34_journey_v1='));
  if (!row) return readJourney(null);
  try {
    return readJourney(decodeURIComponent(row.slice(row.indexOf('=') + 1)));
  } catch {
    return { state: newJourney(), error: '原存档编码有误，本次不覆盖', migrated: false };
  }
}

export function journeyEvent(state, event, value) {
  const s = structuredClone(state);
  if (isSilenced(s, s.currentLayer)) {
    require(['enter-layer', 'memory-trace', 'reunion'].includes(event), '只留下了回声');
  }
  switch (event) {
    case 'garden-sky':
      require(GARDEN_SKIES.includes(value), 'Unknown garden sky');
      s.garden.sky = value;
      break;
    case 'garden-chime':
      require([0, 1, 2].includes(value), 'Unknown chime tone');
      s.garden.chime = value;
      break;
    case 'hello':
      if (s.phase === 'arrive') s.phase = 'shared';
      break;
    case 'touch':
      s.touched = true;
      if (s.phase === 'arrive') s.phase = 'shared';
      break;
    case 'light-moved':
      s.light = Math.max(1, s.light);
      if (sketchValid(value) && value !== null) {
        s.lightSketch = value.map(p => p.map(n => Math.round(n * 10000) / 10000));
      }
      break;
    case 'light-saved':
      require(sketchValid(value) && value !== null, 'Invalid light sketch');
      s.light = 2;
      s.lightSketch = value.map(p => p.map(n => Math.round(n * 10000) / 10000));
      s.bridgeSolid ||= isBridgeArch(s.lightSketch);
      if (s.phase === 'arrive') s.phase = 'shared';
      break;
    case 'enter-layer': {
      require(LAYERS.includes(value), `Unknown layer: ${value}`);
      require(canEnterLayer(s, value), value === 'loft' ? '阁楼的拱里还缺回声' : value === 'drafts' ? '高架桥还等着三座基准柱' : '北面的桥还没有接上');
      if (!s.layers.includes(value)) s.layers.push(value);
      s.currentLayer = value;
      if (['poolrooms','stacks','drafts'].includes(value) && PHASES.indexOf(s.phase) < PHASES.indexOf(value)) s.phase = value;
      if (value === 'loft' && !['closed','after'].includes(s.phase)) s.phase = 'loft';
      break;
    }
    case 'shelf-moved':
      s.shelfMoved = true;
      break;
    case 'rotate-pillar': {
      const pillar = value?.pillar;
      require(['west', 'center', 'east'].includes(pillar), 'Unknown pillar');
      const options = PILLAR_OPTIONS[pillar].map(o => o.id);
      if (value?.value && options.includes(value.value)) {
        s.pillars[pillar] = value.value;
      } else {
        const idx = options.indexOf(s.pillars[pillar]);
        s.pillars[pillar] = options[(idx + 1) % options.length];
      }
      if (pillarsAligned(s.pillars)) s.stacksUnlocked = true;
      break;
    }
    case 'sync-pillars':
      require(s.diagram, '需要先在博客草图中对齐折页基准线');
      s.pillars = { ...TARGET_PILLARS };
      s.stacksUnlocked = true;
      break;
    case 'opened':
      require(NOTES.includes(value), 'Unknown note');
      if (!s.opened.includes(value)) s.opened.push(value);
      break;
    case 'diagram':
      require(s.opened.includes('long-way'), 'Read the source note first');
      s.diagram = true;
      break;
    case 'clue':
      require(CLUES.includes(value), `Unknown clue: ${value}`);
      if (!s.clues.includes(value)) s.clues.push(value);
      if (s.phase === 'arrive') s.phase = 'shared';
      break;
    case 'disagreement':
      require(s.currentLayer === 'drafts' && (s.phase === 'drafts' || s.legacyLoft && s.phase === 'loft') && RESPONSES.includes(value), '原型还没有展开');
      s.response = value;
      s.phase = 'closed';
      break;
    case 'memory-trace':
      require(s.phase === 'closed' && s.currentLayer === value && TRACES.includes(value), '回声不在这里');
      if (!s.traces.includes(value)) s.traces.push(value);
      break;
    case 'reunion':
      require(s.currentLayer === 'loft' && canEnterLayer(s, 'loft') && (s.phase !== 'closed' || s.traces.length === TRACES.length), '回声还没有接起来');
      if (s.phase !== 'after') s.phase = 'loft';
      break;
    case 'complete-loft':
      require(s.currentLayer === 'loft' && ['loft','after'].includes(s.phase) && validSculpture(value), '先和她一起调一座拱');
      s.sculpture = { height: value.height, span: value.span, tone: value.tone };
      s.phase = 'after';
      break;
    case 'finish-legacy-loft':
      require(s.legacyLoft && !s.response && s.currentLayer === 'loft' && identityClueCount(s) >= 2, '旧旅程的阁楼线索尚未集齐');
      s.phase = 'after';
      break;
    case 'letter':
      s.leftLetter = true;
      break;
    default:
      throw new Error(`Unknown journey event: ${event}`);
  }
  return s;
}
