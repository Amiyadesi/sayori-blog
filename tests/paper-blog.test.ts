import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountPaperBlog } from '../public/paper-blog.js';

test('normal blog and SSR never request her articles or mount her space', async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('normal page fetched anomaly content'); };
  try {
    (await mountPaperBlog())();
    globalThis.location = { search: '' } as Location;
    (await mountPaperBlog())();
  } finally {
    globalThis.fetch = fetch;
    delete (globalThis as { location?: Location }).location;
  }
});

test('her writing uses independent Markdown and real Astro routes, not the normal article feed', () => {
  const data = fs.readFileSync(new URL('../src/data/p34-own-posts.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../src/pages/notes/[slug].astro', import.meta.url), 'utf8');
  assert.match(data, /content\/her-space\/\*\.md/);
  assert.match(page, /<Content\s*\/>/);
  assert.match(page, /noindex=\{true\}/);
  assert.match(page, /data-p34-native-post/);
});

test('the existing Astro gate awaits and cleans up asynchronous mounts', () => {
  const layout = fs.readFileSync(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
  assert.match(layout, /await mountPaperBlog\(/);
  assert.match(layout, /else mounted\(\)/);
  for (const event of ['astro:page-load', 'astro:before-swap', 'popstate', 'pageshow']) assert.ok(layout.includes(event));
  assert.match(layout, /twikoo-runtime-host/);
});

test('superseded blog mounts stop before touching DOM; invalid article metadata fails at the boundary', async () => {
  const fetch = globalThis.fetch;
  globalThis.location = { search: '?paper=0617' } as Location;
  try {
    globalThis.fetch = async () => Response.json([{ title: '试写', excerpt: '', draft: true, slug: 'one', path: '/notes/one', href: '/notes/one/?paper=0617' }]);
    (await mountPaperBlog(() => false))();
    globalThis.fetch = async () => Response.json([null]);
    await assert.rejects(mountPaperBlog(() => false), /Invalid article index/);
  } finally {
    globalThis.fetch = fetch;
    delete (globalThis as { location?: Location }).location;
  }
});
