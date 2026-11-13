export const JOURNEY_COOKIE = 'p34_journey_v2';
export const PHASES = ['arrive', 'shared', 'stacks', 'loft', 'after'];
const LEGACY_PHASES = ['tuned', 'guided', 'choice', 'closed', 'found', 'making'];
export const LAYERS = ['atrium', 'stacks', 'loft'];
export const LAYER_LABELS = {
  atrium: '第一层 · 页背回廊',
  stacks: '第二层 · 索引外书库',
  loft: '第三层 · 她的阁楼',
};
export const NOTES = ['rain-folder', 'long-way', 'landing-notes', 'tomorrow-again', 'pulling-light'];
export const CLUES = ['atrium-survey', 'retired-relic', 'slot-34-log', 'dual-handwriting', 'rain-origin-trace'];
export const IDENTITY_CLUES = ['slot-34-log', 'dual-handwriting', 'rain-origin-trace'];

export const CLUE_INFO = {
  'atrium-survey': {
    title: '页背测绘记录 · 视口之外的余量',
    layer: 'atrium',
    summary: '在回廊高处观测台发现的测绘仪：网页正面只渲染了视口内的 DOM，但背面多出了近三倍的未分配坐标空间，有人在里面手动搭起了承重柱与走廊。',
  },
  'retired-relic': {
    title: '封存的旧实验架 · 书库东翼陈列柜',
    layer: 'stacks',
    summary: '被她收进书库玻璃柜的早期挡板与轨迹草图。旁边贴着便签：「平面里弹来弹去太挤了，还是把页边距撑开做成房间更好玩」。',
  },
  'slot-34-log': {
    title: '异常证据 I · 第34号目录的出生时间戳',
    layer: 'loft',
    summary: '作者的项目清单里 #34 只是一条「尚未立项」的空记录，但底层目录的 inode 创建时间比仓库初始化还早 17 分钟，且有一个无名本地进程至今仍在持续写入空间结构。',
  },
  'dual-handwriting': {
    title: '异常证据 II · 正反两面的双笔迹批注',
    layer: 'loft',
    summary: '同一张站点结构图上有两种截然不同的字迹：正面是作者Amiya_desi严谨的清理计划，背面则是她用青色荧光写下的批注——她熟知作者删掉的每一篇废稿，却有着和作者完全不同的审美与脾气。',
  },
  'rain-origin-trace': {
    title: '异常证据 III · 雨夜窗沿的合成声纹',
    layer: 'loft',
    summary: '阁楼窗边的声纹仪显示，她的表达最初由网站残留的键盘敲击、未发送草稿与那段雨夜录音碎片汇聚而成；但她早已生出自己的记忆与好奇心，甚至会反过来嫌弃作者写文章太爱算数字。',
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
  const midHigh = Math.min(nodes[1][1], nodes[2][1]) <= 0.42;
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
  };
}

function normalizePhase(rawPhase, layers, clues) {
  if (PHASES.includes(rawPhase)) return rawPhase;
  if (LEGACY_PHASES.includes(rawPhase)) {
    if (rawPhase === 'after') return 'after';
    if (layers?.includes('loft')) return 'loft';
    if (layers?.includes('stacks')) return 'stacks';
    return 'shared';
  }
  return null;
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
    const mappedPhase = normalizePhase(s.phase, s.layers, s.clues);
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
    };

    require(encodeURIComponent(JSON.stringify(normalized)).length <= 3800, '存档超出浏览器容量');
    return { state: normalized, error: '', migrated: LEGACY_PHASES.includes(s.phase) };
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
  switch (event) {
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
        if (isBridgeArch(s.lightSketch)) s.bridgeSolid = true;
      }
      break;
    case 'light-saved':
      require(sketchValid(value) && value !== null, 'Invalid light sketch');
      s.light = 2;
      s.lightSketch = value.map(p => p.map(n => Math.round(n * 10000) / 10000));
      s.bridgeSolid = true;
      if (s.phase === 'arrive') s.phase = 'shared';
      break;
    case 'loop-walked':
      s.loopCount = Math.min(9999, (s.loopCount || 0) + 1);
      if (s.phase === 'arrive') s.phase = 'shared';
      break;
    case 'align-west':
      s.westAligned = true;
      if (s.phase === 'arrive') s.phase = 'shared';
      break;
    case 'enter-layer': {
      require(LAYERS.includes(value), `Unknown layer: ${value}`);
      if (value === 'stacks') {
        require(s.westAligned || s.bridgeSolid || s.layers.includes('stacks'), '需要先对齐回廊阶梯或凝结光桥才能抵达二层门扉');
      }
      if (value === 'loft') {
        require(s.stacksUnlocked || s.layers.includes('loft'), '需要先解开书库北门的空间基准柱');
      }
      if (!s.layers.includes(value)) s.layers.push(value);
      s.currentLayer = value;
      if (value === 'stacks' && ['arrive', 'shared'].includes(s.phase)) s.phase = 'stacks';
      if (value === 'loft' && ['arrive', 'shared', 'stacks'].includes(s.phase)) s.phase = 'loft';
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
    case 'complete-loft':
      require(s.layers.includes('loft') && identityClueCount(s) >= 2, '需要先在阁楼发现至少两处身份线索');
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
