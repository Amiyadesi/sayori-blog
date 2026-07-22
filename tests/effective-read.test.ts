import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
	EffectiveReadGate,
	calculateArticleProgress,
	readCampaignAttribution,
} from "../src/utils/effective-read.ts";

const root = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("effective read qualification", () => {
	it("requires both 45 visible seconds and 50 percent progress", () => {
		const gate = new EffectiveReadGate(true, 0);
		gate.updateProgress(0.5);

		assert.equal(gate.isQualified(44_999), false);
		assert.equal(gate.isQualified(45_000), true);
	});

	it("does not count hidden-tab time", () => {
		const gate = new EffectiveReadGate(true, 0);
		gate.updateProgress(0.8);
		gate.setVisible(false, 20_000);
		gate.setVisible(true, 80_000);

		assert.equal(gate.visibleMilliseconds(104_999), 44_999);
		assert.equal(gate.isQualified(104_999), false);
		assert.equal(gate.isQualified(105_000), true);
	});

	it("keeps maximum progress and stops after delivery", () => {
		const gate = new EffectiveReadGate(true, 0);
		gate.updateProgress(0.75);
		gate.updateProgress(0.2);
		assert.equal(gate.progress, 0.75);
		assert.equal(gate.isQualified(45_000), true);

		gate.markDelivered();
		assert.equal(gate.isQualified(60_000), false);
	});

	it("measures progress against article content, not the full document", () => {
		assert.equal(
			calculateArticleProgress({
				scrollY: 1_200,
				viewportHeight: 800,
				contentTop: 1_000,
				contentHeight: 2_000,
			}),
			0.5,
		);
	});

	it("reads only bounded UTM attribution", () => {
		assert.deepEqual(
			readCampaignAttribution(
				"https://blog.sayori.org/posts/test/?utm_source=V2EX&utm_medium=community&utm_campaign=launch&utm_content=thread-op&referrer=secret",
			),
			{
				source: "V2EX",
				medium: "community",
				campaign: "launch",
				content: "thread-op",
			},
		);
	});

	it("wires tracking into both post routes and the analytics layout", () => {
		const slugPage = read("src/pages/posts/[...slug].astro");
		const permalinkPage = read("src/pages/[...permalink].astro");
		const analytics = read("src/layouts/partials/AnalyticsScripts.astro");
		const tracker = read("src/scripts/effective-read-tracker.ts");

		assert.match(slugPage, /data-effective-read/);
		assert.match(permalinkPage, /data-effective-read/);
		assert.match(analytics, /startEffectiveReadTracking/);
		assert.match(tracker, /visibilitychange/);
		assert.match(tracker, /swup:pageView/);
		assert.match(tracker, /effective_read/);
	});
});
