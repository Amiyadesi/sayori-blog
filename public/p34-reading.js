import { mountSpace } from './p34-space.js?v=20261107-juice';
export async function mountReadingWorld(isCurrent = () => true) {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).get('paper') !== '0617') return () => {};
  const response = await fetch('/her-space.json');
  if (!response.ok) throw new Error(`Article index: HTTP ${response.status}`);
  const posts = await response.json();
  if (!Array.isArray(posts) || posts.some(post => !post || typeof post.title !== 'string' || typeof post.excerpt !== 'string' || typeof post.draft !== 'boolean' || !/^[a-z0-9-]+$/.test(post.slug) || post.path !== `/notes/${post.slug}` || post.href !== `/notes/${post.slug}/?paper=0617`)) throw new Error('Invalid article index');
  if (!isCurrent()) return () => {};
  return mountSpace({ site: 'blog', posts, isCurrent });
}
