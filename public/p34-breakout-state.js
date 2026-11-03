/**
 * Cookie and state codec for the classic luminous breakout game.
 * Shared between sayori.org (Home) and blog.sayori.org (Blog).
 *
 * Cookie Key: p34_breakout_v1
 * Format: v1.<runs>.<bestScore>.<maxCombo>.<edition>
 * Example: v1.3.1840.12.luminous
 *
 * Does NOT reinterpret old p34_play_v1 best/stars.
 * Preserves p34_world_v1 / story meanings intact.
 */

export const BREAKOUT_COOKIE_KEY = 'p34_breakout_v1';
export const CURRENT_BREAKOUT_EDITION = 'luminous';
export const RECENT_RUNS_STORAGE_KEY = 'p34_breakout_recent_v1';

const TOKEN_PATTERN = /^v1\.(\d{1,6})\.(\d{1,7})\.(\d{1,4})\.([a-z0-9_-]{1,16})$/i;
const MAX_RECENT_RUNS = 10;

export function resolveCookieDomain(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'sayori.org' || h.endsWith('.sayori.org')) return '.sayori.org';
  if (h === 'sayori.local' || h.endsWith('.sayori.local')) return '.sayori.local';
  return '';
}

export function createDefaultBreakoutState() {
  return {
    v: 1,
    runs: 0,
    bestScore: 0,
    maxCombo: 0,
    edition: CURRENT_BREAKOUT_EDITION,
  };
}

export function normalizeBreakoutState(raw) {
  const base = createDefaultBreakoutState();
  if (!raw || typeof raw !== 'object') return base;
  const runs = Number.isFinite(Number(raw.runs)) ? Math.max(0, Math.min(999999, Math.trunc(Number(raw.runs)))) : 0;
  const bestScore = Number.isFinite(Number(raw.bestScore)) ? Math.max(0, Math.min(9999999, Math.trunc(Number(raw.bestScore)))) : 0;
  const maxCombo = Number.isFinite(Number(raw.maxCombo)) ? Math.max(0, Math.min(9999, Math.trunc(Number(raw.maxCombo)))) : 0;
  const editionStr = typeof raw.edition === 'string' && /^[a-z0-9_-]{1,16}$/i.test(raw.edition)
    ? raw.edition.toLowerCase()
    : CURRENT_BREAKOUT_EDITION;
  return {
    v: 1,
    runs,
    bestScore,
    maxCombo,
    edition: editionStr,
  };
}

export function parseBreakoutState(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 64) {
    return { valid: false, state: createDefaultBreakoutState() };
  }
  const match = TOKEN_PATTERN.exec(raw.trim());
  if (!match) {
    return { valid: false, state: createDefaultBreakoutState() };
  }
  const runs = Math.max(0, Math.min(999999, Number(match[1]) || 0));
  const bestScore = Math.max(0, Math.min(9999999, Number(match[2]) || 0));
  const maxCombo = Math.max(0, Math.min(9999, Number(match[3]) || 0));
  const edition = match[4].toLowerCase();
  return {
    valid: true,
    state: {
      v: 1,
      runs,
      bestScore,
      maxCombo,
      edition,
    },
  };
}

export function serializeBreakoutState(state) {
  const s = normalizeBreakoutState(state);
  return `v1.${s.runs}.${s.bestScore}.${s.maxCombo}.${s.edition}`;
}

export function recordBreakoutRun(state, { score = 0, combo = 0, completed = true } = {}) {
  const current = normalizeBreakoutState(state);
  const runScore = Math.max(0, Math.min(9999999, Math.trunc(Number(score) || 0)));
  const runCombo = Math.max(0, Math.min(9999, Math.trunc(Number(combo) || 0)));
  return {
    v: 1,
    runs: current.runs + (completed ? 1 : 0),
    bestScore: Math.max(current.bestScore, runScore),
    maxCombo: Math.max(current.maxCombo, runCombo),
    edition: current.edition,
  };
}

export function readBreakoutCookie(cookieHeader) {
  try {
    const rawCookies = typeof cookieHeader === 'string'
      ? cookieHeader
      : (typeof document !== 'undefined' ? document.cookie : '');
    const part = rawCookies
      .split('; ')
      .find(row => row.startsWith(BREAKOUT_COOKIE_KEY + '='));
    if (part) {
      const val = decodeURIComponent(part.slice(BREAKOUT_COOKIE_KEY.length + 1));
      const parsed = parseBreakoutState(val);
      if (parsed.valid) return parsed.state;
    }
  } catch {}
  return createDefaultBreakoutState();
}

export function writeBreakoutCookie(state, options = {}) {
  if (typeof document === 'undefined') return;
  const serialized = serializeBreakoutState(state);
  const hostname = options.hostname || (typeof location !== 'undefined' ? location.hostname : '');
  const isHttps = options.secure ?? (typeof location !== 'undefined' && location.protocol === 'https:');
  const domain = resolveCookieDomain(hostname);
  const maxAge = Number.isFinite(options.maxAge) ? options.maxAge : 31536000; // 1 year
  const domainAttr = domain ? `; Domain=${domain}` : '';
  const secureAttr = isHttps ? '; Secure' : '';
  document.cookie = `${BREAKOUT_COOKIE_KEY}=${encodeURIComponent(serialized)}${domainAttr}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureAttr}`;
}

export function readRecentRuns() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_RUNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, MAX_RECENT_RUNS)
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        date: typeof item.date === 'string' ? item.date.slice(0, 32) : new Date().toISOString(),
        score: Math.max(0, Math.min(9999999, Math.trunc(Number(item.score) || 0))),
        maxCombo: Math.max(0, Math.min(9999, Math.trunc(Number(item.maxCombo) || 0))),
        edition: typeof item.edition === 'string' ? item.edition.slice(0, 16) : CURRENT_BREAKOUT_EDITION,
      }));
  } catch {
    return [];
  }
}

export function appendRecentRun(run = {}) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const list = readRecentRuns();
    const entry = {
      date: typeof run.date === 'string' ? run.date.slice(0, 32) : new Date().toISOString(),
      score: Math.max(0, Math.min(9999999, Math.trunc(Number(run.score) || 0))),
      maxCombo: Math.max(0, Math.min(9999, Math.trunc(Number(run.maxCombo) || 0))),
      edition: typeof run.edition === 'string' ? run.edition.slice(0, 16) : CURRENT_BREAKOUT_EDITION,
    };
    list.unshift(entry);
    const bounded = list.slice(0, MAX_RECENT_RUNS);
    localStorage.setItem(RECENT_RUNS_STORAGE_KEY, JSON.stringify(bounded));
    return bounded;
  } catch {
    return [];
  }
}
