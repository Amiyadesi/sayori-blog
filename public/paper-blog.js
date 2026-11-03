import { mountLivingWorld } from './p34-living.js?v=20261102-r12';
export function mountPaperBlog() {
  if (new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  return mountLivingWorld();
}
