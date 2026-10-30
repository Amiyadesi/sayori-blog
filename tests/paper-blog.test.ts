import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const engine = read("public/paper-blog.js");
function harness(search = "?paper=0617", reduce = false, hasDoll = false) {
  const attrs = new Map([["src", "/normal-doll.webp"], ["srcset", "/normal-doll-2x.webp 2x"], ["sizes", "112px"]]);
  const dollClasses = new Set<string>();
  const doll = { getAttribute(name:string) { return attrs.get(name) ?? null; }, setAttribute(name:string,value:string) { attrs.set(name,value); }, removeAttribute(name:string) { attrs.delete(name); }, classList:{add(name:string){dollClasses.add(name);},remove(name:string){dollClasses.delete(name);}} };
  const classes = new Set<string>();
  const styleNodes: any[] = [];
  const handlers = new Map<string, { fn: Function; signal: AbortSignal }[]>();
  const classList = { add: (...names: string[]) => names.forEach(n => classes.add(n)), remove: (...names: string[]) => names.forEach(n => classes.delete(n)), toggle: (n: string, on: boolean) => on ? classes.add(n) : classes.delete(n) };
  const door = { attrs: new Map([["display", "none"]]), removeAttribute(n: string) { this.attrs.delete(n); }, setAttribute(n: string, v: string) { this.attrs.set(n, v); } };
  const signature = { textContent: "Amiya_desi" };
  const caption = { textContent: "Original caption" };
  const screenshot = { label: "Original screenshot", getAttribute() { return this.label; }, setAttribute(_: string, value: string) { this.label = value; } };
  const comparison = { hidden: true };
  const author = { href: "https://sayori.org/", getAttribute() { return this.href; }, setAttribute(_: string, href: string) { this.href = href; } };
  class Details {
    open = false;
    matches() { return true; }
    closest() { return { classList }; }
    querySelector(selector: string) { return ({ "[data-paper-second-door]": door, "[data-paper-signature]": signature, "[data-paper-caption]": caption, svg: screenshot } as any)[selector]; }
  }
  const proof = new Details();
  const document = {
    documentElement: { classList },
    head: { append(node: any) { styleNodes.push(node); } },
    createElement() { const node = { remove() { styleNodes.splice(styleNodes.indexOf(node), 1); } }; return node; },
    querySelector(selector: string) { return ({ "[data-paper-proof]": proof, "[data-paper-comparison]": comparison, "[data-paper-author]": author, "img.desk-avatar":hasDoll?doll:null } as any)[selector]; },
    querySelectorAll() { return [{ classList }]; },
    addEventListener(name: string, fn: Function, options: any) { handlers.set(name, [...(handlers.get(name) || []), { fn, signal: options.signal }]); },
  };
  const media = { matches: reduce, addEventListener(name: string, fn: Function, options: any) { handlers.set(`media:${name}`, [{ fn, signal: options.signal }]); } };
  const context = vm.createContext({ mountP34:()=>({destroy(){},setLevel(){},triggerVhsGlitch(){},level:1,reducedMotion:reduce}),mountTextDecay:()=>()=>{},mountDateScramble:()=>()=>{}, document, location: { search }, URLSearchParams, AbortController, matchMedia: () => media, HTMLDetailsElement: Details, Element: class {}, setTimeout, clearTimeout });
  vm.runInContext(engine.replace(/^import .*;\r?\n/gm, "").replace("export function", "function") + ";globalThis.mount = mountPaperBlog", context);
  return { attrs, dollClasses, mount: context.mount as () => () => void, classes, styleNodes, door, signature, caption, comparison, author, proof, handlers, media,
    emit(name: string, target: unknown) { handlers.get(name)?.forEach(h => { if (!h.signal.aborted) h.fn({ target }); }); } };
}

test("normal mode does not mount visual resources or listeners", () => {
  const h = harness(""); h.mount()();
  assert.equal(h.styleNodes.length, 0); assert.equal(h.handlers.size, 0); assert.equal(h.classes.size, 0);
});
test("attachment interaction changes the same screenshot and signature; cleanup restores it", () => {
  const h = harness(); const cleanup = h.mount();
  assert.equal(h.styleNodes.length, 1); assert.ok(h.classes.has("blog-altered"));
  assert.equal(h.signature.textContent, "Amiya_desi");
  assert.equal(h.author.href, "https://sayori.org/?paper=0617");
  h.proof.open = true; h.emit("toggle", h.proof);
  assert.equal(h.door.attrs.has("display"), false); assert.equal(h.signature.textContent, "正在阅读的人"); assert.equal(h.comparison.hidden, false);
  cleanup();
  assert.equal(h.styleNodes.length, 0); assert.equal(h.classes.size, 0);
  assert.equal(h.door.attrs.get("display"), "none"); assert.equal(h.signature.textContent, "Amiya_desi"); assert.equal(h.author.href, "https://sayori.org/");
  h.emit("toggle", h.proof); assert.equal(h.signature.textContent, "Amiya_desi");
  const again = h.mount(); assert.equal(h.styleNodes.length, 1); again();
});
test("reduced motion follows the OS and remains clean on teardown", () => {
  const h = harness("?paper=0617", true); const cleanup = h.mount();
  assert.ok(h.classes.has("blog-still"));
  h.media.matches = false; h.emit("media:change", null); assert.ok(!h.classes.has("blog-still"));
  cleanup(); assert.equal(h.classes.size, 0);
});
test("native route contains dated manual index, author check and accessible screenshot", () => {
  const route = read("src/pages/project-34.astro");
  for (const expected of ["MainGridLayout", "<Markdown", "<PostCard note={note}", "P34-0617", "0.3.4", "2026-06-17T02:13:00+08:00", "2026-06-17T03:40:00+08:00", "人工录入", "没有导出可执行文件", "data-paper-author", "data-paper-proof", 'display="none"']) assert.ok(route.includes(expected), expected);
  assert.equal(fs.existsSync(new URL("../public/project-34/index.html", import.meta.url)), false);
  assert.match(read("src/components/features/posts/PostCard.astro"), /timeZone: "Asia\/Shanghai"/);
});
test("no console, guide, duplicated search, page transform or global link transport", () => {
  const css = read("public/paper-blog.css");
  const publicNarrative = engine + read("src/pages/project-34.astro");
  assert.doesNotMatch(publicNarrative, /我记得|87 分钟|发布早于导出|ROOM-00|chat\.sayori\.org|blog-anomaly-bar|blog-reader-panel|blog-search-chips|write social|uv-secret/);
  assert.doesNotMatch(css, /#swup-container[^}]*animation/s);
  assert.doesNotMatch(engine, /querySelectorAll\(['"]a|localStorage|createElement\(['"]canvas/);
  assert.match(css, /prefers-reduced-motion/); assert.match(engine, /650/);
});
test("native settings and search are the only extra interactions", () => {
  const settings = read("src/components/features/settings/OptionalFeatures.astro");
  assert.match(settings, /data-paper-preference/); assert.match(settings, /destination\.searchParams\.set\("paper", "0617"\)/);
  const search = read("src/scripts/desk-search.ts");
  assert.match(search, /new URLSearchParams\(location.search\).get\("paper"\) === "0617"/);
  assert.match(search, /\/project-34\/\?paper=0617/);
  const layout = read("src/layouts/Layout.astro");
  assert.ok(layout.indexOf('get("paper") !== "0617"') < layout.indexOf('await import('));
  assert.match(layout, /astro:before-swap/); assert.match(layout, /pagehide/);
});

test("normal doll stays normal; anomaly swaps only that doll and cleanup restores srcset",()=>{
  const normal=harness("",false,true);normal.mount()();assert.equal(normal.attrs.get("src"),"/normal-doll.webp");assert.equal(normal.dollClasses.size,0);
  const changed=harness("?paper=0617",false,true);const dispose=changed.mount();assert.equal(changed.attrs.get("src"),"/assets/paper/sayori-torn-display.png");assert.equal(changed.attrs.has("srcset"),false);assert.equal(changed.dollClasses.has("paper-character"),true);dispose();assert.equal(changed.attrs.get("src"),"/normal-doll.webp");assert.equal(changed.attrs.get("srcset"),"/normal-doll-2x.webp 2x");assert.equal(changed.attrs.get("sizes"),"112px");assert.equal(changed.dollClasses.size,0);
  assert.doesNotMatch(engine,/artHost|hiddenArt|createElement\('img'\)|querySelector\('\.desk-shell'\)/);
});

test('VHS material, decay and archive search stay inside anomaly mode',()=>{
 const runtime=read('public/p34-organic.js'),shared=read('public/p34-organic.css');
 assert.match(runtime,/feTurbulence/);assert.match(runtime,/feDisplacementMap/);assert.match(runtime,/localStorage.setItem\(LEVEL_KEY/);assert.match(runtime,/0.005/);assert.match(runtime,/0.00375/);assert.match(runtime,/AudioContext/);assert.match(runtime,/duration = 0.2/);
 assert.match(shared,/#b8b4a2/);assert.match(shared,/#a89f78/);assert.match(shared,/180ms/);assert.match(shared,/\.secret-text::selection/);
 const search=read('src/scripts/desk-search.ts');assert.match(search,/function openArchive/);assert.match(search,/if \(openArchive\(\)\) return/);assert.match(search,/p34-record\/\?paper=0617&record=0617/);
 const archive=read('src/pages/p34-record.astro');assert.match(archive,/data-p34-archive/);assert.match(archive,/class="decay-text"/);assert.match(archive,/class="secret-text"/);assert.match(archive,/noindex/);
});
