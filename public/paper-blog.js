import { mountReadingWorld } from './p34-reading.js?v=20261103-luminous';

export function mountPaperBlog() {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  return mountReadingWorld();
}
