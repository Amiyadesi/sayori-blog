import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("post engagement sharing", () => {
	const script = read("src/scripts/post-engagement.ts");

	it("shows only copy, supported native sharing, poster, and an authenticated growth shortcut", () => {
		const source = read("src/components/features/posts/PostEngagement.astro");
		assert.match(source, /data-copy-share/);
		assert.match(source, /data-native-share hidden/);
		assert.match(source, /postGeneratePoster/);
		assert.match(source, /data-promote-post hidden/);
		assert.doesNotMatch(source, /service\.weibo\.com|twitter\.com\/intent|t\.me\/share|facebook\.com\/sharer/);
		assert.doesNotMatch(source, /data-share-count/);
	});

	it("tracks a share only after copy, native share, or poster success", () => {
		const poster = read("src/components/misc/SharePoster.svelte");
		assert.match(script, /copyTextWithFeedback\(url\)[\s\S]*\.then\(\(\) => track\("share", "copy"/);
		assert.match(script, /navigator[\s\S]*\.share\(\{ title, url \}\)[\s\S]*\.then\(\(\) => track\("share", "native"/);
		assert.match(script, /error\.name === "AbortError"/);
		assert.match(poster, /sayori:share-success/);
	});

	it("provides a selected-text fallback when clipboard copying fails", () => {
		const source = read("src/components/features/posts/PostEngagement.astro");
		assert.match(source, /data-copy-fallback-input/);
		assert.match(script, /copyFallbackInput\.select\(\)/);
	});

	it("shows visible poster download feedback before recording success", () => {
		const poster = read("src/components/misc/SharePoster.svelte");
		assert.match(poster, /downloaded = true/);
		assert.match(poster, /postPosterDownloadStarted/);
		assert.ok(
			poster.indexOf("downloaded = true") <
				poster.indexOf('new CustomEvent("sayori:share-success"'),
		);
	});
});
