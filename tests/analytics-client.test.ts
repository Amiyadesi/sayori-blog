import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";

const source = fs.readFileSync(
	path.join(process.cwd(), "src/layouts/partials/AnalyticsScripts.astro"),
	"utf8",
);

test("analytics heartbeat is bounded and initialized once", () => {
	assert.match(source, /const heartbeatMs = 60000;/);
	assert.match(source, /dataset\.sayoriAnalyticsTracker/);
});

test("both trackers require an explicitly allowed analytics preference", () => {
	assert.match(source, /if \(localStorage\.getItem\(analyticsPreferenceKey\) === "allow"\) loadAnalytics\(\)/);
	assert.match(source, /if \(localStorage\.getItem\(analyticsPreferenceKey\) === "allow"\) startCollector\(\)/);
	assert.equal((source.match(/if \(event\.detail === true\)/g) || []).length, 2);
	assert.doesNotMatch(source, /onInteraction|10000/);
});

test("blog HTML prevents Cloudflare's automatic analytics injection without changing asset caching", async () => {
	for (const type of ["text/html; charset=utf-8", "text/css"]) {
		const original = new Response("body", { headers: {
			"Content-Type": type,
			"Cache-Control": "public, max-age=60",
		} });
		const result = await onRequest({
			request: new Request("https://blog.sayori.org/fr/"),
			next: async () => original,
		});
		assert.equal(result.headers.get("cache-control"), type.startsWith("text/html")
			? "public, max-age=60, no-transform"
			: "public, max-age=60");
		assert.equal(await result.text(), "body");
	}
});
