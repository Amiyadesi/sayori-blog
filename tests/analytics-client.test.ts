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
