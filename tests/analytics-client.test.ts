import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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
