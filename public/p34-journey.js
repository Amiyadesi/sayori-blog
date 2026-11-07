export const JOURNEY_COOKIE = 'p34_journey_v2';
export const PHASES = ['arrive', 'shared', 'tuned', 'guided', 'choice', 'closed', 'found', 'making', 'after'];
export const VERSIONS = ['draft', 'tuned', 'guided'];
export const EDITIONS = { draft: '初稿', tuned: '改手感', guided: '自动瞄准' };
export const NOTES = ['rain-folder', 'long-way', 'landing-notes', 'tomorrow-again', 'pulling-light'];
export const STAGE_COUNT = 24;
const counters = ['launches', 'returns', 'misses', 'clears', 'hits', 'perfect', 'seconds'];
const opinions = ['free', 'clear', 'both', 'unsure'];
const integer = (n, max = 65535) => Number.isInteger(n) && n >= 0 && n <= max;
const require = (value, message) => { if (!value) throw new Error(message); };
const sketchValid = nodes => nodes === null || Array.isArray(nodes) && nodes.length === 4 && nodes.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1));
const emptyTrials = () => Object.fromEntries(VERSIONS.map(v=>[v,{returns:0,misses:0,clears:0}]));

export function newJourney() {
  return { v: 2, phase: 'arrive', touched: false, light: 0, lightSketch: null,
    plays: Object.fromEntries(VERSIONS.map(v => [v, Object.fromEntries(counters.map(k => [k, 0]))])), trials: emptyTrials(), lastReturn: null,
    campaign: { stage: 0, unlocked: 0, records: {} }, feedback: { draft: '', tuned: '' }, opinion: '', opened: [],
    difference: false, diagram: false, keepsake: '', keptReturn: null, workshop: { x: 960, kept: null, placed: false, attempts: 0, cleared: false }, leftLetter: false };
}
export const trialReady = (s, version) => s.trials[version].clears > 0 || s.trials[version].returns >= 6 || s.trials[version].misses >= 3;
export const campaignReady = s => Object.keys(s.campaign.records).length >= 2 || s.plays.draft.seconds >= 90 && (s.plays.draft.returns>=6 || s.plays.draft.misses>=3);
export function availableVersions(s) {
  const index = PHASES.indexOf(s.phase);
  return VERSIONS.slice(0, index >= 3 ? 3 : index >= 2 ? 2 : 1);
}
export function readJourney(raw) {
  if (raw === null) return { state: newJourney(), error: '', migrated: false };
  try {
    require(typeof raw === 'string' && raw.length <= 8000, '存档过长');
    const s = JSON.parse(raw);
    if (s?.v === 1) {
      require(PHASES.includes(s.phase) && [0, 1, 2].includes(s.light) && sketchValid(s.lightSketch ?? null) && typeof s.leftLetter === 'boolean', '旧存档格式有误');
      const state = newJourney();
      state.phase = s.phase === 'arrive' ? 'arrive' : 'shared';
      state.touched = s.touched === true; state.light = s.light; state.lightSketch = s.lightSketch ?? null; state.leftLetter = s.leftLetter;
      // The old cookie stays untouched; paper-bird play is not breakout play.
      return { state, error: '', migrated: true };
    }
    require(s?.v === 2, '存档版本不兼容');
    require(PHASES.includes(s.phase), '进度格式有误');
    require(['touched', 'difference', 'diagram', 'leftLetter'].every(k => typeof s[k] === 'boolean'), '经历格式有误');
    require([0, 1, 2].includes(s.light) && sketchValid(s.lightSketch), '光稿格式有误');
    require(VERSIONS.every(v => s.plays?.[v] && counters.every(k => integer(s.plays[v][k]))), '试玩记录有误');
    // Early v2 saved acquaintance/light before native trials were available.
    s.trials ??= emptyTrials(); s.lastReturn ??= null; s.keptReturn ??= null;
    require(VERSIONS.every(v=>s.trials[v]&&['returns','misses','clears'].every(k=>integer(s.trials[v][k]))), '对照试玩记录有误');
    require(s.lastReturn===null || Array.isArray(s.lastReturn)&&s.lastReturn.length===2&&s.lastReturn.every(Number.isFinite)&&Math.abs(s.lastReturn[0])<=1&&Math.abs(s.lastReturn[1])<=Math.PI, '回球记录有误');
    require(s.keptReturn===null || Array.isArray(s.keptReturn)&&s.keptReturn.length===2&&s.keptReturn.every(Number.isFinite)&&Math.abs(s.keptReturn[0])<=1&&Math.abs(s.keptReturn[1])<=Math.PI, '留存回球有误');
    const c = s.campaign;
    require(c && integer(c.stage, STAGE_COUNT - 1) && integer(c.unlocked, STAGE_COUNT - 1) && c.stage <= c.unlocked, '关卡进度有误');
    require(c.records && !Array.isArray(c.records) && Object.entries(c.records).every(([id, result]) => /^\d+$/.test(id) && integer(Number(id), STAGE_COUNT - 1) && Number(id) <= c.unlocked && Array.isArray(result) && result.length === 2 && integer(result[0], 100000000) && integer(result[1])), '过关记录有误');
    require(s.feedback && ['draft', 'tuned'].every(v => ['', ...opinions].includes(s.feedback[v])) && ['', ...opinions].includes(s.opinion), '评价格式有误');
    require(Array.isArray(s.opened) && s.opened.length <= NOTES.length && new Set(s.opened).size === s.opened.length && s.opened.every(n => NOTES.includes(n)), '文章记录有误');
    require(['', 'round', 'light', 'empty'].includes(s.keepsake), '留存物有误');
    const w = s.workshop;
    require(w && Number.isFinite(w.x) && w.x >= 400 && w.x <= 1500 && (w.kept === null || Number.isFinite(w.kept) && w.kept >= 400 && w.kept <= 1500), '工作间位置有误');
    require(integer(w.attempts) && typeof w.placed === 'boolean' && typeof w.cleared === 'boolean', '共作记录有误');
    require(encodeURIComponent(JSON.stringify(s)).length <= 3800, '存档超出浏览器容量');
    return { state: s, error: '', migrated: false };
  } catch (e) { return { state: newJourney(), error: `原存档保留：${e instanceof SyntaxError ? '文件格式有误' : e.message}`, migrated: false }; }
}
export function cookieJourney(cookies) {
  const rows = cookies.split(';').map(s => s.trim());
  const row = rows.find(s => s.startsWith(JOURNEY_COOKIE + '=')) || rows.find(s => s.startsWith('p34_journey_v1='));
  if (!row) return readJourney(null);
  try { return readJourney(decodeURIComponent(row.slice(row.indexOf('=') + 1))); }
  catch { return { state: newJourney(), error: '原存档编码有误，本次不覆盖', migrated: false }; }
}
export function journeyEvent(state, event, value) {
  const s = structuredClone(state);
  switch (event) {
    case 'hello': if (s.phase === 'arrive') s.phase = 'shared'; break;
    case 'touch': s.touched = true; if (s.phase === 'arrive') s.phase = 'shared'; break;
    case 'light-moved': s.light = Math.max(1, s.light); break;
    case 'light-saved': require(sketchValid(value) && value !== null, 'Invalid light sketch'); s.light = 2; s.lightSketch = value.map(p => p.map(n => Math.round(n * 10000) / 10000)); break;
    case 'play': {
      require(availableVersions(s).includes(value.edition) && ['campaign', 'trial', 'seeking', 'workshop'].includes(value.mode), 'Unknown game session');
      require(counters.every(k => integer(value.delta[k])), 'Invalid play counters');
      require(integer(value.stage, STAGE_COUNT - 1), 'Invalid stage');
      for (const k of counters) s.plays[value.edition][k] = Math.min(65535, s.plays[value.edition][k] + value.delta[k]);
      if(value.mode==='trial')for(const k of ['returns','misses','clears'])s.trials[value.edition][k]=Math.min(65535,s.trials[value.edition][k]+value.delta[k]);
      if(value.kind==='return') {
        require(Number.isFinite(value.offset)&&Math.abs(value.offset)<=1&&Number.isFinite(value.vx)&&Number.isFinite(value.vy), 'Invalid return');
        s.lastReturn=[Math.round(value.offset*1000)/1000,Math.round(Math.atan2(value.vy,value.vx)*1000)/1000];
      }
      if (value.delta.launches > 0 && s.phase === 'arrive') s.phase = 'shared';
      if (value.mode === 'campaign') {
        require(value.stage <= s.campaign.unlocked, 'Stage not unlocked');
        if(['ready','stage','launch'].includes(value.kind))s.campaign.stage = value.stage;
        if (value.kind === 'clear') {
          require(integer(value.score, 100000000) && integer(value.seconds), 'Invalid result');
          const old = s.campaign.records[value.stage];
          if (!old || value.score > old[0]) s.campaign.records[value.stage] = [value.score, value.seconds];
          s.campaign.unlocked = Math.max(s.campaign.unlocked, Math.min(STAGE_COUNT - 1, value.stage + 1));
          s.campaign.stage = Math.min(STAGE_COUNT - 1, value.stage + 1);
        }
      }
      if (value.mode === 'seeking' && value.kind === 'found') {
        require(s.phase === 'closed' && s.difference && s.diagram && value.edition === 'draft', 'Missing return evidence');
        s.phase = 'found';
      }
      if (value.mode === 'workshop' && value.kind === 'place') {
        require(['making', 'after'].includes(s.phase) && Number.isFinite(value.x) && value.x >= 400 && value.x <= 1500, 'Invalid workshop placement');
        s.workshop.x = Math.round(value.x); s.workshop.placed = true;
      }
      if (value.mode === 'workshop' && s.phase === 'making' && s.workshop.placed && ['miss', 'clear'].includes(value.kind)) {
        s.workshop.attempts=Math.min(65535,s.workshop.attempts+1); s.workshop.cleared ||= value.kind === 'clear';
      }
      break;
    }
    case 'feedback':
      require(['draft', 'tuned'].includes(value.version) && opinions.includes(value.value), 'Unknown feedback');
      require(trialReady(s, value.version), 'Feedback needs actual play');
      s.feedback[value.version] = value.value;
      if (value.version === 'draft' && ['arrive', 'shared'].includes(s.phase)) s.phase = 'tuned';
      if (value.version === 'tuned' && s.phase === 'tuned') s.phase = 'guided';
      break;
    case 'opinion': require(s.phase === 'guided' && trialReady(s, 'guided') && opinions.includes(value), 'Compare needs actual play'); s.opinion = value; s.phase = 'choice'; break;
    case 'withdraw': require(s.phase === 'choice', 'No release decision yet'); s.phase = 'closed'; break;
    case 'opened': require(NOTES.includes(value), 'Unknown note'); if (!s.opened.includes(value)) s.opened.push(value); break;
    case 'difference': require(s.phase === 'closed', 'Not comparing closed works'); s.difference = true; break;
    case 'diagram': require(s.opened.includes('long-way'), 'Read the source note first'); s.diagram = true; break;
    case 'keepsake':
      require(s.phase === 'found' && (value === 'empty' || value === 'round' && s.plays.draft.returns > 0 || value === 'light' && s.light === 2), 'No such shared memory');
      s.keepsake = value; s.keptReturn = value === 'round' ? s.lastReturn : null; break;
    case 'make': require(s.phase === 'found' && s.keepsake, 'Choose a shared memory'); s.phase = 'making'; break;
    case 'continue':
      require(s.phase === 'making' && s.workshop.placed && (s.workshop.cleared || s.workshop.attempts >= 2), 'Try the change together first');
      s.workshop.kept = s.workshop.x; s.workshop.x += s.workshop.x > 1440 ? -60 : 60; s.phase = 'after'; break;
    case 'letter': s.leftLetter = true; break;
    default: throw new Error(`Unknown journey event: ${event}`);
  }
  return s;
}
