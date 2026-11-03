export const PLAY_COOKIE = 'p34_routes';
export const newPlayState = () => ({ met: 0, edition: 1, first: 0, second: 0, archive: 0, best: 0 });

export function parsePlayState(raw) {
  const m = typeof raw === 'string' && /^1\.([01])\.([12])\.([0-7])\.([0-7])\.([01])\.(\d{1,4})$/.exec(raw);
  return m ? { met: +m[1], edition: +m[2], first: +m[3], second: +m[4], archive: +m[5], best: +m[6] } : newPlayState();
}
export function serializePlayState(s) {
  if (![0, 1].includes(s.met) || ![1, 2].includes(s.edition) || ![s.first, s.second].every(n => Number.isInteger(n) && n >= 0 && n <= 7) || ![0, 1].includes(s.archive) || !Number.isInteger(s.best) || s.best < 0 || s.best > 9999) throw new RangeError('Invalid route save');
  return `1.${s.met}.${s.edition}.${s.first}.${s.second}.${s.archive}.${s.best}`;
}
export function completeRoute(s, { route, edition, shots, hits }) {
  if (!Number.isInteger(route) || route < 0 || route > 2 || ![1, 2].includes(edition) || !Number.isInteger(shots) || shots < 1 || !Number.isInteger(hits) || hits < 1 || hits > 9999) throw new RangeError('Invalid route result');
  const key = edition === 1 ? 'first' : 'second';
  return { ...s, [key]: s[key] | (1 << route), best: Math.max(s.best, hits) };
}
export function installUpdate(s) {
  if (s.first !== 7) throw new Error('Finish the first three routes before the update');
  return { ...s, edition: 2 };
}
export function openPlaySession(cookie) {
  return {
    get() {
      const row = document.cookie.split('; ').find(p => p.startsWith(PLAY_COOKIE + '='));
      return parsePlayState(row?.slice(PLAY_COOKIE.length + 1));
    },
    set(next) { cookie(PLAY_COOKIE, serializePlayState(next)); return { ...next }; },
  };
}
