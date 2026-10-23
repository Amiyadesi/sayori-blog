import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(
		/\s+/g,
		" ",
	);

test("ARG entry leaves the Astro router and always uses the root Chinese game", () => {
	const entry = read("src/components/features/posts/DeskIntro.astro");
	assert.match(entry, /href="\/unsaved\/" data-astro-reload/);
	assert.match(entry, /Chinese ARG/);
});

test("public story pages retain standalone runtime, source links and noindex boundary", () => {
	for (const path of [
		"index.html",
		"margins/index.html",
		"shelf/index.html",
	]) {
		const html = read(`public/unsaved/${path}`);
		assert.match(html, /name="robots" content="noindex,nofollow"/);
		assert.match(html, /name="referrer" content="no-referrer"/);
		assert.match(html, /<body data-pagefind-ignore/);
		assert.match(html, /type="module" src="\/unsaved\/app.js"/);
		assert.match(html, /https:\/\/sayori.org\/unsaved\//);
		assert.doesNotMatch(html, /https:\/\/.*(?:\.mp3|\.woff|\.png)["?]/);
	}
});
