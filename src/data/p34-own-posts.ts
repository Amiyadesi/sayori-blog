import type { MarkdownInstance } from 'astro';
interface Frontmatter { title: string; description: string; draft: boolean; }
const entries = import.meta.glob<MarkdownInstance<Frontmatter>>('../content/her-space/*.md', { eager: true });
export const HER_OWN_POSTS = Object.entries(entries).map(([file, entry]) => {
  const slug = file.split('/').pop()!.replace(/\.md$/, '');
  const { title, description, draft } = entry.frontmatter;
  if (!/^[a-z0-9-]+$/.test(slug) || typeof title !== 'string' || !title.trim() || typeof description !== 'string' || typeof draft !== 'boolean') throw new Error(`Invalid writing metadata: ${file}`);
  return { title, excerpt: description, draft, slug, path: `/notes/${slug}`, href: `/notes/${slug}/?paper=0617`, Content: entry.Content };
});
export type OwnPost = (typeof HER_OWN_POSTS)[number];
