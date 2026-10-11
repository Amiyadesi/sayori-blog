import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const source = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

async function requestPage(hostname, pathname, { offline = false } = {}) {
	const handlers = new Map();
	const oldPage = new Response("old page");
	let response;
	vm.runInNewContext(source, {
		URL,
		self: {
			location: { hostname, origin: `https://${hostname}` },
			addEventListener: (name, handler) => handlers.set(name, handler),
		},
		caches: {
			match: async () => oldPage,
			open: async () => ({ put: async () => {} }),
		},
		fetch: async () => {
			if (offline) throw new Error("offline");
			return new Response("new page");
		},
	});
	handlers.get("fetch")({
		request: new Request(`https://${hostname}${pathname}`),
		respondWith: pending => { response = pending; },
	});
	return response && (await response).text();
}

test("ClientRouter requests use fresh blog HTML instead of a stale cached page", async () => {
	for (const route of ["/zh-hant/settings/", "/posts/example", "/posts/example.html"]) {
		assert.equal(await requestPage("blog.sayori.org", route), "new page");
	}
});

test("offline pages, hashed assets, API exclusions and diary behavior are preserved", async () => {
	assert.equal(await requestPage("blog.sayori.org", "/en/about/", { offline: true }), "old page");
	assert.equal(await requestPage("blog.sayori.org", "/_astro/page.123.js"), "old page");
	assert.equal(await requestPage("blog.sayori.org", "/api/twikoo"), undefined);
	assert.equal(await requestPage("diary.sayori.org", "/about/"), "old page");
});
