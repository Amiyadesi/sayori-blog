// Project 34 · 剧情状态（v2）
// 与旧的 p34_world_v1 分开：那个只记录"她在哪见过你"，这个记录故事走到了哪。
// 纯逻辑，不碰 DOM，方便单测。

export const STORY_COOKIE = 'p34_story';
export const LEGACY_COOKIE = 'p34_world_v1';

export const CHAPTERS = ['arrive', 'explore', 'doubt', 'rift', 'closed', 'search', 'reconcile', 'free'];

export const CLUES = [
  'old-version',   // 她留下又被替换掉的旧版作品
  'update-log',    // 修改日志
  'draft-note',    // 她写给自己的草稿
  'deleted-work',  // 被删掉的小游戏
  'mirror-page',   // 不在导航里的页面
  'empty-shelf',   // 架子上空掉的那一格
  'store',         // 她手动搭的商店页
  'game',          // 《溯》里的密码机
];

export const TOPICS = [
  'works',      // 你做的东西
  'why-edit',   // 为什么总在改
  'old',        // 那些旧版本
  'deleted',    // 你删掉的那个
  'ok',         // 你还好吗
];

export const WORKS = ['light', 'words', 'drift'];

const bit = (list, id) => {
  const i = list.indexOf(id);
  return i < 0 ? 0 : 1 << i;
};

export function createStory() {
  return {
    v: 2,
    chapter: 'arrive',
    met: 0,
    trust: 0,
    pressure: 0,
    clues: [],
    topics: [],
    works: { light: 0, words: 0, drift: 0 },
    beats: {},
  };
}

const clampChapter = (name) => (CHAPTERS.includes(name) ? name : 'arrive');

export function normalizeStory(raw) {
  const s = { ...createStory(), ...(raw || {}) };
  s.v = 2;
  s.chapter = clampChapter(s.chapter);
  s.met = s.met ? 1 : 0;
  s.trust = Math.max(0, Math.min(100, Math.trunc(Number(s.trust) || 0)));
  s.pressure = Math.max(0, Math.min(100, Math.trunc(Number(s.pressure) || 0)));
  s.clues = Array.isArray(s.clues) ? s.clues.filter((c) => CLUES.includes(c)) : [];
  s.topics = Array.isArray(s.topics) ? s.topics.filter((t) => TOPICS.includes(t)) : [];
  const works = typeof s.works === 'object' && s.works ? s.works : {};
  s.works = Object.fromEntries(WORKS.map((id) => [id, works[id] ? 1 : 0]));
  s.beats = typeof s.beats === 'object' && s.beats ? { ...s.beats } : {};
  return s;
}

/* 旧的 p34_world_v1 只有 aff（好感）和 st（阶段）。迁移时只取这两样，别的一概不继承。 */
export function migrateFromWorld(world) {
  const s = createStory();
  if (!world) return s;
  s.met = world.st > 0 || world.first !== 'none' ? 1 : 0;
  s.trust = Math.max(0, Math.min(40, Math.trunc(Number(world.aff) || 0)));
  if (s.met) s.chapter = 'explore';
  return s;
}

export function serializeStory(story) {
  const s = normalizeStory(story);
  let clueMask = 0;
  for (const c of s.clues) clueMask |= bit(CLUES, c);
  let topicMask = 0;
  for (const t of s.topics) topicMask |= bit(TOPICS, t);
  let workMask = 0;
  WORKS.forEach((w, i) => { if (s.works[w]) workMask |= 1 << i; });
  const ci = CHAPTERS.indexOf(s.chapter);
  return `2.${ci}.${s.met}.${s.trust}.${s.pressure}.${clueMask.toString(16)}.${topicMask.toString(16)}.${workMask.toString(16)}`;
}

export function parseStory(raw) {
  if (typeof raw !== 'string') return { valid: false, story: createStory() };
  const parts = raw.trim().split('.');
  if (parts.length !== 8 || parts[0] !== '2') return { valid: false, story: createStory() };
  const [, ci, met, trust, pressure, clueHex, topicHex, workHex] = parts;
  const chapterIndex = Number(ci);
  if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= CHAPTERS.length) {
    return { valid: false, story: createStory() };
  }
  if (!Number.isFinite(Number(trust)) || !Number.isFinite(Number(pressure))) {
    return { valid: false, story: createStory() };
  }
  const clueMask = parseInt(clueHex, 16) || 0;
  const topicMask = parseInt(topicHex, 16) || 0;
  const workMask = parseInt(workHex, 16) || 0;
  const story = normalizeStory({
    chapter: CHAPTERS[chapterIndex],
    met: Number(met) ? 1 : 0,
    trust: Number(trust),
    pressure: Number(pressure),
    clues: CLUES.filter((_, i) => clueMask & (1 << i)),
    topics: TOPICS.filter((_, i) => topicMask & (1 << i)),
    works: Object.fromEntries(WORKS.map((w, i) => [w, workMask & (1 << i) ? 1 : 0])),
  });
  return { valid: true, story };
}

/* 探索：发现线索会加信任，也会加一点她的焦虑（她又被人看到一处没做完的地方）。 */
export function discover(story, clue) {
  const s = normalizeStory(story);
  if (!CLUES.includes(clue) || s.clues.includes(clue)) return { story: s, fresh: false, unlockedTopics: [] };
  s.clues = [...s.clues, clue];
  s.trust = Math.min(100, s.trust + 6);
  s.pressure = Math.min(100, s.pressure + 4);
  const before = new Set(s.topics);
  for (const t of topicsFor(s)) s.topics = [...s.topics, t];
  const unlockedTopics = s.topics.filter((t) => !before.has(t));
  if (s.chapter === 'arrive' && s.met) s.chapter = 'explore';
  return { story: s, fresh: true, unlockedTopics };
}

export function topicsFor(story) {
  const s = normalizeStory(story);
  const has = (c) => s.clues.includes(c);
  const out = ['works'];
  if (has('old-version')) out.push('old');
  if (has('deleted-work')) out.push('deleted');
  if (has('update-log') || has('draft-note')) out.push('why-edit');
  if (s.chapter === 'rift' || s.chapter === 'closed' || s.chapter === 'search') out.push('ok');
  return out.filter((t) => TOPICS.includes(t));
}

/* 玩过一件作品：她更信任你，但也更容易觉得"还该再好一点"。 */
export function finishWork(story, workId) {
  const s = normalizeStory(story);
  if (!WORKS.includes(workId)) return s;
  s.works = { ...s.works, [workId]: 1 };
  s.trust = Math.min(100, s.trust + 4);
  if (s.chapter === 'explore' && Object.values(s.works).every(Boolean)) s.pressure = Math.min(100, s.pressure + 10);
  return s;
}

/* 对话：问到敏感处，压力上涨；好好回答，信任上涨。 */
export function talk(story, topic, tone) {
  const s = normalizeStory(story);
  const blunt = tone === 'blunt';
  if (blunt) {
    s.pressure = Math.min(100, s.pressure + 9);
    s.trust = Math.max(0, s.trust - 2);
  } else {
    s.trust = Math.min(100, s.trust + 2);
    s.pressure = Math.max(0, s.pressure - 1);
  }
  return s;
}

/* 章节推进：由压力和信任共同决定，不由玩家选。 */
export function advanceChapter(story) {
  const s = normalizeStory(story);
  const played = Object.values(s.works).filter(Boolean).length;
  switch (s.chapter) {
    case 'arrive':
      if (s.met) s.chapter = 'explore';
      break;
    case 'explore':
      if (played >= 2 && s.trust >= 18) s.chapter = 'doubt';
      break;
    case 'doubt':
      if (s.pressure >= 45) s.chapter = 'rift';
      break;
    case 'rift':
      if (s.pressure >= 70) s.chapter = 'closed';
      break;
    case 'closed':
      if (s.clues.includes('mirror-page') && s.clues.includes('empty-shelf')) s.chapter = 'search';
      break;
    case 'search':
      if (s.clues.includes('draft-note')) s.chapter = 'reconcile';
      break;
    case 'reconcile':
      if (s.trust >= 30) s.chapter = 'free';
      break;
    default:
      break;
  }
  return s;
}

/* 世界是不是被她关上了：这期间作品不可玩。 */
export function worksLocked(story) {
  const s = normalizeStory(story);
  return s.chapter === 'closed' || s.chapter === 'search' || s.chapter === 'reconcile';
}

/* 页面该有的情绪：给她自己的演出用，也给 store 页读取。 */
export function worldMood(story) {
  const s = normalizeStory(story);
  const p = s.pressure;
  if (s.chapter === 'free') return 'warm';
  if (s.chapter === 'reconcile') return 'soft';
  if (s.chapter === 'closed' || s.chapter === 'search') return 'hollow';
  if (s.chapter === 'rift') return p >= 60 ? 'cracked' : 'tense';
  if (p >= 30) return 'jittery';
  return s.trust > 30 ? 'playful' : 'warm';
}
