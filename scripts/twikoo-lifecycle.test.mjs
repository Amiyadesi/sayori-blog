import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/components/comment/Twikoo.astro", import.meta.url), "utf8");
const script = source.match(/<script\s[\s\S]*?>([\s\S]*?)<\/script>/)[1];
const document = new EventTarget();
const window = new EventTarget();
const calls = [];
const observers = [];
let page;
let finishOldIdentity;
let destroyed = 0;
function makePage() {
	const mount = { innerHTML: "", querySelector: () => null };
	const root = new EventTarget();
	Object.assign(root, {
		dataset: {}, querySelectorAll: () => [],
		querySelector: selector => selector === "#tcomment" ? mount : selector.includes(".twikoo") ? root.rendered : null,
	});
	return root;
}
Object.assign(document, {
	readyState: "complete", body: { classList: { contains: () => true } },
	getElementById: () => page,
});
Object.assign(window, {
	location: { pathname: "/old/", origin: "https://blog.sayori.org", hash: "#comments" },
	setTimeout, clearTimeout,
	twikoo: { init: async config => {
		calls.push(config.path);
		page.rendered = { __vue__: { $destroy: () => destroyed++ } };
	} },
});
const context = vm.createContext({
	window, document, AbortController, Event, URL, console,
	localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
	MutationObserver: class {
		constructor() { observers.push(this); }
		observe() {}
		disconnect() { this.disconnected = true; }
	},
	config: { path: "/old/", adminLogin: "Amiyadesi" }, ownerNick: "Amiya_desi", ownerAvatar: "/avatar.jpg", reviewOnly: false, isEnglishSite: false,
	fetch: () => new Promise(resolve => { finishOldIdentity = resolve; }),
});
const flush = () => new Promise(resolve => setImmediate(resolve));
page = makePage();
vm.runInContext(script, context);
await flush();
document.dispatchEvent(new Event("astro:before-swap"));
finishOldIdentity({ ok: false });
await flush();
assert.deepEqual(calls, [], "an old page must not initialize after navigation");
for (const path of ["/new/", "/third/", "/new/"]) {
	page = makePage();
	window.location.pathname = path;
	context.config = { path, adminLogin: "Amiyadesi" };
	context.fetch = async () => ({ ok: false });
	vm.runInContext(script, context);
	await flush();
	document.dispatchEvent(new Event("astro:page-load"));
	window.dispatchEvent(new Event("hashchange"));
	await flush();
	assert.equal(calls.at(-1), path);
	document.dispatchEvent(new Event("astro:before-swap"));
}
assert.deepEqual(calls, ["/new/", "/third/", "/new/"], "each visit initializes once, including back navigation");
assert.equal(destroyed, 3);
assert.ok(observers.every(observer => observer.disconnected));
