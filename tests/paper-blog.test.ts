import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountPaperBlog } from '../public/paper-blog.js';
import {
  HER_OWN_POSTS,
  getOwnPostBySlug,
  getOwnPostByPath,
  isOwnNotePath,
  resolveLegacyBlogHash,
  shouldCarryPaperQuery,
  applyReadingEncounterStory,
  readingDialogueNode,
  mountReadingWorld,
  formatBreakoutNote,
  initialVoiceCopy,
} from '../public/p34-reading.js';
import { HER_OWN_POSTS as ASTRO_OWN_POSTS } from '../src/data/p34-own-posts.ts';
import { HER_OWN_POSTS as CANONICAL_OWN_POSTS } from '../public/p34-own-posts.js';
import { readBreakoutCookie } from '../public/p34-breakout-state.js';
import {
  parseWorldState,
  serializeWorldState,
} from '../public/p34-living.js';
import { createStory, parseStory, serializeStory } from '../public/p34-story.js';

test('normal blog does not mount world DOM, resources, state, or audio', () => {
  globalThis.location = { search: '' } as Location;
  try {
    mountPaperBlog()();
    mountReadingWorld()();
  } finally {
    delete (globalThis as { location?: Location }).location;
  }
});

test('retired build-note and investigation routes stay redirected', () => {
  for (const file of ['src/pages/project-34.astro', 'src/pages/p34-record.astro']) {
    const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(source, /paper=0617/);
    assert.doesNotMatch(source, /data-paper-proof|decay-text|paper-note-card/);
  }
});

test('Layout manages fullscreen luminous blog lifecycle and SPA/bfcache hooks', () => {
  const layout = fs.readFileSync(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /classList\.add\(['"]p34-world['"]\)/);
  assert.match(layout, /p34-reading\.css/);
  assert.match(layout, /ClientRouter/);
  assert.match(layout, /twikoo-runtime-host/);
  assert.match(layout, /astro:page-load/);
  assert.match(layout, /astro:before-swap/);
  assert.match(layout, /popstate/);
  assert.match(layout, /pagehide/);
  assert.match(layout, /pageshow/);
});

test('shared baseline p34 modules stay text-identical (normalized line endings) with home while own blog world is isolated', () => {
  const homeDir = new URL('../../sayori-home/public/', import.meta.url);
  const blogDir = new URL('../public/', import.meta.url);
  assert.equal(fs.existsSync(new URL('p34-reading.js', blogDir)), true);
  assert.equal(fs.existsSync(new URL('p34-reading.css', blogDir)), true);
  if (fs.existsSync(homeDir)) {
    for (const file of [
      'p34-living.js',
      'p34-living.css',
      'p34-motion.js',
      'p34-motion.css',
      'p34-arc.js',
      'p34-arc.css',
      'p34-dialogue.js',
      'p34-dialogue.css',
      'p34-story.js',
      'p34-breakout-state.js',
      'p34-fx.js',
    ]) {
      assert.equal(
        fs.readFileSync(new URL(file, blogDir), 'utf8').replace(/\r\n/g, '\n'),
        fs.readFileSync(new URL(file, homeDir), 'utf8').replace(/\r\n/g, '\n'),
        file,
      );
    }
  }
});

test('three substantive own articles share one canonical source between Astro data and client world without touching Amiya source posts', () => {
  assert.equal(HER_OWN_POSTS.length, 3);
  assert.equal(ASTRO_OWN_POSTS, CANONICAL_OWN_POSTS);
  assert.deepEqual(HER_OWN_POSTS, ASTRO_OWN_POSTS);

  // Verify article data is defined once in public/p34-own-posts.js and not duplicated in p34-reading.js or src/data/p34-own-posts.ts
  const canonicalSource = fs.readFileSync(new URL('../public/p34-own-posts.js', import.meta.url), 'utf8');
  const readingSource = fs.readFileSync(new URL('../public/p34-reading.js', import.meta.url), 'utf8');
  const astroTsSource = fs.readFileSync(new URL('../src/data/p34-own-posts.ts', import.meta.url), 'utf8');
  assert.match(canonicalSource, /RAW_OWN_POSTS/);
  assert.doesNotMatch(readingSource, /RAW_OWN_POSTS/);
  assert.doesNotMatch(astroTsSource, /RAW_OWN_POSTS/);

  const slugs = HER_OWN_POSTS.map(p => p.slug);
  assert.deepEqual(slugs, ['prism-and-paddle', 'empty-corners', 'afternoon-rankings']);

  for (const post of HER_OWN_POSTS) {
    assert.equal(getOwnPostBySlug(post.slug)?.title, post.title);
    assert.equal(getOwnPostByPath(`/notes/${post.slug}/`)?.slug, post.slug);
    assert.equal(isOwnNotePath(`/notes/${post.slug}/`), true);
    assert.ok(post.paragraphs.length >= 2, `expected non-empty paragraphs for ${post.slug}`);
    const fullText = [post.title, post.excerpt, post.lead, post.voiceRemark, ...post.paragraphs].join('\n');
    assert.doesNotMatch(
      fullText,
      /字句像呼吸|留白是灵魂|冷白底色|冷白纸面|DOM|CSS|HTML|两天两夜|靠在椅背|面包云|扁云|橘子汽水|一觉睡到天黑|上面那些色块|右上角最后那两块|人类视频|我没有身体|我尝不到|尝不出|缓存里|风才吹得进来|剩下的地方才立得住/,
    );
  }

  const gamePost = getOwnPostBySlug('prism-and-paddle')!;
  assert.match(gamePost.paragraphs.join('\n'), /按钮|挡板|球/);
  assert.doesNotMatch(gamePost.paragraphs.join('\n'), /三棱镜|光弦|卡片/);
  const cornersPost = getOwnPostBySlug('empty-corners')!;
  assert.match(cornersPost.paragraphs.join('\n'), /边|逗号/);

  // Article 3 is her concise sound ranking without ontology exposition
  const afternoonPost = getOwnPostBySlug('afternoon-rankings')!;
  assert.equal(afternoonPost.title, '暂时第一名：倒汽水的声音');
  const afternoonText = afternoonPost.paragraphs.join('\n');
  assert.match(afternoonText, /汽水|冰/);
  assert.match(afternoonText, /四个音/);

  // Index uses actual persistent article titles (title + date only, no boxed preview excerpt or duplicated '展开全文' CTA)
  assert.match(readingSource, /p34-entry-date/);
  assert.match(readingSource, /p34-entry-title/);
  assert.doesNotMatch(readingSource, /p34-entry-excerpt|p34-entry-preview|展开全文/);

  // No visible masthead '返回原站' button, no boxed voice/next-article cards, no automatic margin score panel
  const noteRouteAstro = fs.readFileSync(new URL('../src/pages/notes/[slug].astro', import.meta.url), 'utf8');
  const readingCss = fs.readFileSync(new URL('../public/p34-reading.css', import.meta.url), 'utf8');
  for (const banned of ['返回原站', 'data-p34-return', 'p34-own-nav-return', 'p34-voice-card', 'p34-next-card', 'p34-next-grid', 'data-p34-breakout-note']) {
    assert.ok(!readingSource.includes(banned), `public/p34-reading.js must not include ${banned}`);
    assert.ok(!readingCss.includes(banned), `public/p34-reading.css must not include ${banned}`);
    assert.ok(!noteRouteAstro.includes(banned), `src/pages/notes/[slug].astro must not include ${banned}`);
  }

  // True Amiya markdown posts stay untouched
  const styleMd = fs.readFileSync(new URL('../src/content/posts/blog-style-change/index.md', import.meta.url), 'utf8');
  const gmtkMd = fs.readFileSync(new URL('../src/content/posts/after-gmtk/index.md', import.meta.url), 'utf8');
  assert.ok(styleMd.includes('小卡片装饰'));
  assert.ok(gmtkMd.includes('砍掉了所有的解密'));

  // Astro route template is noindex and gated, and excluded from sitemap in astro.config.mjs
  assert.match(noteRouteAstro, /noindex=\{true\}/);
  assert.match(noteRouteAstro, /paper.*0617/);
  const astroConfig = fs.readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  assert.match(astroConfig, /pathname\.startsWith\(["']\/notes\/["']\)/);
});

test('fullscreen CSS owns the whole viewport and keeps the normal blog chrome out', () => {
  const readingCss = fs.readFileSync(new URL('../public/p34-reading.css', import.meta.url), 'utf8');
  const readingJs = fs.readFileSync(new URL('../public/p34-reading.js', import.meta.url), 'utf8');

  assert.match(readingCss, /\.p34-reading-architecture/);
  assert.match(readingCss, /min-height:\s*100svh/);
  assert.match(readingCss, /\.desk-header[\s\S]*?display:\s*none\s*!important/);
  assert.match(readingCss, /html:not\(\.p34-luminous\)\s*\[data-p34-own-route\]/);
  assert.doesNotMatch(readingJs, /p34-reading-marker|p34-side-observation|BLOG_READING_ANCHORS/);
});

test('legacy store and scene hashes resolve to her own blog index and articles', () => {
  for (const hash of [
    '#blog',
    '#space',
    '#play',
    '#note-light-folds',
    '#note-moving-words',
    '#note-half-torn',
    '#note-borrowed-margin',
    '#log',
  ]) {
    const resolved = resolveLegacyBlogHash(hash, '/');
    assert.ok(resolved, `expected resolution for ${hash}`);
    assert.ok(resolved.message.length > 0);
  }
  assert.equal(resolveLegacyBlogHash('#blog', '/')?.type, 'index');
  assert.equal(resolveLegacyBlogHash('#space', '/')?.slug, 'prism-and-paddle');
  assert.equal(resolveLegacyBlogHash('#play', '/')?.slug, 'prism-and-paddle');
  assert.equal(resolveLegacyBlogHash('#log', '/')?.slug, 'empty-corners');
  assert.equal(resolveLegacyBlogHash('#note-half-torn', '/')?.slug, 'empty-corners');
  assert.equal(resolveLegacyBlogHash('#unknown-hash', '/'), null);
});

test('paper query travels through internal blog routes and main Home links while skipping feeds/APIs', () => {
  assert.equal(
    shouldCarryPaperQuery('/notes/prism-and-paddle/', 'https://blog.sayori.org'),
    '/notes/prism-and-paddle/?paper=0617',
  );
  assert.equal(
    shouldCarryPaperQuery('https://sayori.org/', 'https://blog.sayori.org'),
    'https://sayori.org/?paper=0617',
  );
  assert.equal(
    shouldCarryPaperQuery('/notes/prism-and-paddle/?paper=0617', 'https://blog.sayori.org'),
    null,
  );
  assert.equal(shouldCarryPaperQuery('/rss/', 'https://blog.sayori.org'), null);
  assert.equal(shouldCarryPaperQuery('/api/post-interactions', 'https://blog.sayori.org'), null);
  assert.equal(shouldCarryPaperQuery('https://amiya-desi.itch.io/', 'https://blog.sayori.org'), null);
});

test('reading encounter preserves existing story chapters, pressure, and clues without rewriting saves', () => {
  const fresh = createStory();
  const afterFirst = applyReadingEncounterStory(fresh);
  assert.equal(afterFirst.met, 1);
  assert.equal(afterFirst.chapter, 'explore');

  for (const chapter of ['doubt', 'rift', 'closed', 'search', 'reconcile', 'free'] as const) {
    const saved = {
      ...createStory(),
      met: 1,
      chapter,
      trust: 34,
      pressure: 64,
      clues: ['deleted-work', 'draft-note'],
      topics: ['works', 'deleted', 'why-edit'],
    };
    const preserved = applyReadingEncounterStory(saved);
    assert.equal(preserved.chapter, chapter);
    assert.equal(preserved.pressure, 64);
    assert.equal(preserved.trust, 34);
    assert.deepEqual(preserved.clues, ['deleted-work', 'draft-note']);
    const roundTrip = parseStory(serializeStory(preserved));
    assert.equal(roundTrip.valid, true);
    assert.equal(roundTrip.story.chapter, chapter);
    assert.equal(roundTrip.story.pressure, 64);
  }

  const worldToken = serializeWorldState({ first: 'blog', bm: 1, st: 1, aff: 3 });
  const parsedWorld = parseWorldState(worldToken);
  assert.equal(parsedWorld.valid, true);
  assert.equal(parsedWorld.state.first, 'blog');
  assert.equal(parsedWorld.state.bm, 1);
});

test('p34_breakout_v1 consumer reads valid records, ignores legacy keys, and formats note only when runs > 0', () => {
  const absent = readBreakoutCookie('');
  assert.deepEqual(absent, { v: 1, runs: 0, bestScore: 0, maxCombo: 0, edition: 'luminous' });

  const valid = readBreakoutCookie('p34_breakout_v1=v1.3.1840.12.luminous');
  assert.deepEqual(valid, { v: 1, runs: 3, bestScore: 1840, maxCombo: 12, edition: 'luminous' });

  const legacyOnly = readBreakoutCookie('p34_play_v1=v1.99.9999.50.arcade');
  assert.equal(legacyOnly.runs, 0);
  assert.equal(legacyOnly.bestScore, 0);

  assert.equal(formatBreakoutNote({ v: 1, runs: 0, bestScore: 0, maxCombo: 0, edition: 'luminous' }), null);

  const note = formatBreakoutNote({ v: 1, runs: 3, bestScore: 1840, maxCombo: 12, edition: 'luminous' });
  assert.ok(note);
  assert.equal(note.runs, 3);
  assert.equal(note.bestScore, 1840);
  assert.equal(note.maxCombo, 12);
  assert.match(note.text, /你在主页留下的弹球最高纪录/);
  assert.doesNotMatch(note.text, /刚才/);
  assert.match(note.text, /1840/);
  assert.match(note.text, /12/);
  assert.equal(note.linkHref, 'https://sayori.org/?paper=0617');
});

test('voice copy and inline dialogue respond to encounterType, active own article, and breakout stats in chat context', () => {
  for (const kind of ['blog-first', 'blog-from-home', 'blog-return']) assert.ok(initialVoiceCopy('/', kind).length);
  for (const post of HER_OWN_POSTS) assert.equal(initialVoiceCopy(post.path, 'blog-first'), post.voiceRemark);

  const story = createStory();
  const rootIndex = readingDialogueNode('root', story, { pathname: '/', encounterType: 'blog-first' });
  assert.doesNotMatch(rootIndex.text, /我把原来的/);
  assert.ok(rootIndex.choices.some(c => c.id === 'talk-prism'));
  assert.ok(rootIndex.choices.some(c => c.id === 'talk-corners'));
  assert.ok(rootIndex.choices.some(c => c.id === 'return'));

  const prismNode = readingDialogueNode('talk-prism', story, { pathname: '/notes/prism-and-paddle/' });
  assert.match(prismNode.text, /球/);

  const prismWithStats = readingDialogueNode('talk-prism', story, {
    pathname: '/notes/prism-and-paddle/',
    breakout: { v: 1, runs: 3, bestScore: 1840, maxCombo: 12, edition: 'luminous' },
  });
  assert.match(prismWithStats.text, /1840/);
  assert.match(prismWithStats.text, /12/);

  const afternoonNode = readingDialogueNode('talk-afternoon', story, { pathname: '/notes/afternoon-rankings/' });
  assert.ok(afternoonNode.choices.some(c => c.id === 'open-afternoon'));
});

test('article dialogue opens stable routes directly without another confirmation menu', () => {
  const story = createStory();
  for (const [id, slug] of [['open-prism','prism-and-paddle'],['open-corners','empty-corners'],['open-afternoon','afternoon-rankings']]) {
    const node = readingDialogueNode(id, story);
    assert.equal(node.action, 'open-post');
    assert.equal(node.slug, slug);
    assert.equal(getOwnPostBySlug(slug)?.href, node.href);
  }
  const source = fs.readFileSync(new URL('../public/p34-reading.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /articleViewEl\.innerHTML|stageEl\.replaceChildren/);
  assert.match(source, /entry\.classList\.toggle\('is-active'/);
});

test('built static output isolates own article routes from normal sitemap, feeds, and index', () => {
  const buildDir = new URL('../.codex-tmp/p34-native-build/', import.meta.url);
  if (!fs.existsSync(buildDir)) return;

  for (const post of HER_OWN_POSTS) {
    const htmlUrl = new URL(`notes/${post.slug}/index.html`, buildDir);
    assert.equal(fs.existsSync(htmlUrl), true, `missing built route for ${post.slug}`);
    const html = fs.readFileSync(htmlUrl, 'utf8');
    assert.match(html, /name="robots"\s+content="noindex/i);
    assert.match(html, /data-pagefind-ignore="all"/);
    assert.ok(html.includes(post.title));
    for (const para of post.paragraphs) {
      assert.ok(html.includes(para.slice(0, 24)), `missing paragraph in built HTML for ${post.slug}`);
    }
  }

  for (const normalArtifact of ['sitemap-0.xml', 'rss.xml', 'atom.xml', 'llms.txt', 'index.html']) {
    const fileUrl = new URL(normalArtifact, buildDir);
    if (fs.existsSync(fileUrl)) {
      const content = fs.readFileSync(fileUrl, 'utf8');
      assert.doesNotMatch(content, /\/notes\/(?:prism-and-paddle|empty-corners|afternoon-rankings)/);
    }
  }
});
