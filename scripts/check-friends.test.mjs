import assert from "node:assert/strict";
import { test } from "node:test";

import {
	checkFriends,
	mergeResults,
	normalizeUrl,
	parseFrontmatter,
} from "./check-friends.mjs";

test("parses friend frontmatter and normalizes site URLs", () => {
	const frontmatter = parseFrontmatter([
		"---",
		'title: "Example blog"',
		"siteurl: https://example.com/#home",
		"linkpage: https://example.com/friends/",
		"visible: true",
		"---",
		"note",
	].join("\n"));

	assert.equal(frontmatter.title, "Example blog");
	assert.equal(normalizeUrl(frontmatter.siteurl), "https://example.com/");
	assert.equal(frontmatter.linkpage, "https://example.com/friends/");
});

test("retries a failed site and detects an optional backlink", async () => {
	let siteAttempts = 0;
	const friend = {
		title: "Example",
		siteUrl: "https://example.com/",
		linkPage: "https://example.com/friends/",
		visible: true,
		source: "example.md",
		key: "https://example.com/",
	};

	const results = await checkFriends([friend], {
		attempts: 2,
		retryDelayMs: 0,
		fetchImpl: async (url) => {
			if (url.endsWith("/friends/")) {
				return new Response('<a href="https://blog.sayori.org/friends/">Sayori</a>', { status: 200 });
			}
			siteAttempts += 1;
			return siteAttempts === 1 ? new Response("retry", { status: 503 }) : new Response("ok", { status: 200 });
		},
	});

	assert.equal(results[0].status, "up");
	assert.equal(results[0].attempts, 2);
	assert.equal(results[0].backlink.status, "found");
});

test("targeted checks preserve other friend results", () => {
	const friends = [
		{ title: "One", siteUrl: "https://one.example/", key: "https://one.example/", linkPage: null, source: "one.md" },
		{ title: "Two", siteUrl: "https://two.example/", key: "https://two.example/", linkPage: null, source: "two.md" },
	];
	const checked = [{ title: "One", siteUrl: friends[0].siteUrl, status: "up", backlink: { status: "not_configured" } }];
	const previous = [{ title: "Two", siteUrl: friends[1].siteUrl, status: "timeout", backlink: { status: "not_configured" } }];
	const merged = mergeResults(friends, checked, previous, "One");

	assert.deepEqual(merged.map((item) => item.status), ["up", "timeout"]);
});
