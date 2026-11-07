export const JOURNEY_COOKIE = 'p34_journey_v1';
export const PHASES = ['arrive', 'shared', 'tuned', 'guided', 'choice', 'closed', 'found', 'making', 'after'];
export const VERSIONS = ['draft', 'tuned', 'guided'];
export const NOTES = ['rain-folder', 'long-way', 'landing-notes', 'tomorrow-again', 'pulling-light'];
const answers = ['free', 'clear', 'unsure'];
const count = n => Number.isInteger(n) && n >= 0 && n <= 255;
const add = n => Math.min(255, n + 1);
const require = (test, message) => { if (!test) throw new Error(message); };

export function newJourney() {
  const flight = () => ({ shots: 0, landings: 0, misses: 0, wins: 0, path: [0], detour: false });
  return { v: 1, phase: 'arrive', touched: false, light: 0, lightSketch: null,
    flights: { draft: flight(), tuned: flight(), guided: flight() },
    feedback: { draft: '', tuned: '' }, opinion: '', opened: [],
    difference: false, diagram: false, keepsake: '', position: [305, -180], keptPosition: null,
    placed: false, attempts: 0, landed: false, leftLetter: false, campaign:newCampaign() };
}

export function trialReady(s, version) {
  const f = s.flights[version];
  return f.wins > 0 || f.landings >= 2 || f.misses >= 3;
}
export const campaignReady = s => Object.keys(s.campaign.records).length >= 3 || s.campaign.checkpoint?.shots >= 8;
export function availableVersions(s) {
  const n = PHASES.indexOf(s.phase);
  return VERSIONS.slice(0, n >= 3 ? 3 : n >= 2 ? 2 : 1);
}

export function readJourney(raw) {
  if (raw === null) return { state: newJourney(), error: '' };
  try {
    require(typeof raw === 'string' && raw.length <= 8000, '存档过长');
    const s = JSON.parse(raw);
    require(s?.v === 1, '存档版本不兼容');
    require(PHASES.includes(s.phase), '进度格式有误');
    require(['touched', 'difference', 'diagram', 'placed', 'landed', 'leftLetter'].every(k => typeof s[k] === 'boolean'), '经历格式有误');
    require([0, 1, 2].includes(s.light) && count(s.attempts), '次数格式有误');
    s.lightSketch ??= null;
    require(s.lightSketch === null || Array.isArray(s.lightSketch) && s.lightSketch.length === 4 && s.lightSketch.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1)), '光稿格式有误');
    for (const v of VERSIONS) {
      const f = s.flights?.[v];
      require(f && ['shots', 'landings', 'misses', 'wins'].every(k => count(f[k])) && typeof f.detour === 'boolean', '试玩记录有误');
      require(Array.isArray(f.path) && f.path.length > 0 && f.path.length <= 8 && f.path.every(n => Number.isInteger(n) && n >= 0 && n <= 6), '路线有误');
    }
    require(s.feedback && ['draft', 'tuned'].every(v => ['', ...answers].includes(s.feedback[v])), '评价格式有误');
    require(['', 'free', 'clear', 'both', 'unsure'].includes(s.opinion), '选择格式有误');
    require(Array.isArray(s.opened) && s.opened.length <= NOTES.length && s.opened.every(n => NOTES.includes(n)), '文章记录有误');
    require(['', 'route', 'light', 'empty'].includes(s.keepsake), '留存物有误');
    require(Array.isArray(s.position) && s.position.length === 2 && s.position.every(Number.isFinite) && s.position[0] >= 200 && s.position[0] <= 440 && s.position[1] >= -340 && s.position[1] <= -120, '工作间落点有误');
    s.keptPosition ??= null;
    require(s.keptPosition === null || Array.isArray(s.keptPosition) && s.keptPosition.length === 2 && s.keptPosition.every(Number.isFinite) && s.keptPosition[0] >= 200 && s.keptPosition[0] <= 440 && s.keptPosition[1] >= -340 && s.keptPosition[1] <= -120, '留存落点有误');
    s.campaign = s.campaign === undefined ? newCampaign() : readCampaign(JSON.stringify(s.campaign));
    require(encodeURIComponent(JSON.stringify(s)).length <= 3800, '存档超出浏览器容量');
    return { state: s, error: '' };
  } catch (e) { return { state: newJourney(), error: `原存档保留。${e instanceof SyntaxError ? '文件格式有误，请选择导出的旅程存档。' : e.message}` }; }
}

export function cookieJourney(cookies) {
  const row = cookies.split(';').map(s => s.trim()).find(s => s.startsWith(JOURNEY_COOKIE + '='));
  if (!row) return readJourney(null);
  try { return readJourney(decodeURIComponent(row.slice(JOURNEY_COOKIE.length + 1))); }
  catch { return { state: newJourney(), error: '原存档编码有误，本次暂不覆盖。' }; }
}

export function journeyEvent(state, event, value) {
  const s = structuredClone(state);
  switch (event) {
    case 'hello': if (s.phase === 'arrive') s.phase = 'shared'; break;
    case 'touch': s.touched = true; if (s.phase === 'arrive') s.phase = 'shared'; break;
    case 'light-moved': s.light = Math.max(1, s.light); break;
    case 'light-saved': s.light = 2; if (value) s.lightSketch = value.map(p => p.map(n => Math.round(n * 10000) / 10000)); break;
    case 'launch': case 'land': case 'miss': case 'win': {
      require(availableVersions(s).includes(value.version), 'Edition not available');
      const f = s.flights[value.version];
      if (event === 'launch') { f.shots = add(f.shots); if (value.first || value.node === 0) f.path = [value.node]; if (s.phase === 'arrive') s.phase = 'shared'; }
      if (event === 'miss') f.misses = add(f.misses);
      if (event === 'win') f.wins = add(f.wins);
      if (event === 'land') {
        f.landings = add(f.landings); f.detour ||= value.node === 5;
        if (f.path.at(-1) !== value.node) f.path = [...f.path, value.node].slice(-8);
        if (value.node === 6) {
          require(s.phase === 'closed' && s.difference && s.diagram, 'Missing route evidence');
          s.phase = 'found';
        }
      }
      break;
    }
    case 'feedback':
      require(['draft', 'tuned'].includes(value.version) && answers.includes(value.value), 'Unknown feedback');
      require(trialReady(s, value.version), 'Feedback needs actual play');
      s.feedback[value.version] = value.value;
      if (value.version === 'draft' && ['arrive', 'shared'].includes(s.phase)) s.phase = 'tuned';
      if (value.version === 'tuned' && s.phase === 'tuned') s.phase = 'guided';
      break;
    case 'opinion':
      require(s.phase === 'guided' && trialReady(s, 'guided'), 'Compare needs actual play');
      require(['free', 'clear', 'both', 'unsure'].includes(value), 'Unknown opinion');
      s.opinion = value; s.phase = 'choice'; break;
    case 'withdraw': require(s.phase === 'choice', 'No release decision yet'); s.phase = 'closed'; break;
    case 'opened': require(NOTES.includes(value), 'Unknown note'); if (!s.opened.includes(value)) s.opened.push(value); break;
    case 'difference': require(s.phase === 'closed', 'Not comparing closed works'); s.difference = true; break;
    case 'diagram': require(s.opened.includes('long-way'), 'Open the source note first'); s.diagram = true; break;
    case 'keepsake':
      require(s.phase === 'found', 'Not reunited');
      require(value === 'empty' || value === 'route' && s.flights.tuned.shots > 0 || value === 'light' && s.light === 2, 'No such keepsake');
      s.keepsake = value; break;
    case 'make': require(s.phase === 'found' && s.keepsake, 'Choose a shared memory'); s.phase = 'making'; break;
    case 'place':
      require(s.phase === 'making' || s.phase === 'after', 'Workshop unavailable');
      require(Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && value[0] >= 200 && value[0] <= 440 && value[1] >= -340 && value[1] <= -120, 'Invalid landing position');
      s.position = value.map(Math.round); s.placed = true; break;
    case 'test': require(s.phase === 'making' && s.placed, 'Place the landing first'); s.attempts = add(s.attempts); s.landed ||= value === true; break;
    case 'continue':
      require(s.phase === 'making' && s.placed && (s.landed || s.attempts >= 3), 'Try the creation together first');
      s.keptPosition = [...s.position]; s.phase = 'after'; s.position = [Math.min(440, s.position[0] + 14), Math.max(-340, s.position[1] - 8)]; break;
    case 'letter': s.leftLetter = true; break;
    case 'campaign-save': {
      const records = { ...s.campaign.records };
      for (const [id, result] of Object.entries(value.records)) {
        const old = records[id];
        if (!old || result.shots < old.shots || result.shots === old.shots && result.seconds < old.seconds) records[id] = result;
      }
      s.campaign = { ...value, records };
      if (s.phase === 'arrive' && (value.checkpoint?.shots > 0 || Object.keys(records).length)) s.phase = 'shared';
      break;
    }
    default: throw new Error(`Unknown journey event: ${event}`);
  }
  return s;
}
import { newCampaign, readCampaign } from './p34-flight-levels.js?v=20261107-journey';
