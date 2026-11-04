import { mountReadingWorld } from './p34-reading.js?v=20261104-pixelfx';

export function mountPaperBlog() {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  return mountReadingWorld();
}
