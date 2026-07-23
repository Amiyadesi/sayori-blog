import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	classifySearchOpportunity,
	formatGrowthMetric,
	rankTopicCandidates,
	reviewCampaign,
	shouldRemindDevlog,
} from "../src/utils/growth.ts";

describe("growth domain rules", () => {
	it("requires Search Console evidence before creating an opportunity", () => {
		assert.deepEqual(
			classifySearchOpportunity({
				query: "godot game jam",
				clicks: 0,
				impressions: 19,
				ctr: 0,
				position: 8,
			}),
			{
				eligible: false,
				reason: "insufficient_evidence",
				expectedCtr: null,
			},
		);
		assert.equal(
			classifySearchOpportunity({
				query: "godot game jam",
				clicks: 2,
				impressions: 80,
				ctr: 0.025,
				position: 7,
			}).reason,
			"position",
		);
	});

	it("flags clearly low CTR at a strong ranking", () => {
		const result = classifySearchOpportunity({
			query: "sayori blog",
			clicks: 1,
			impressions: 100,
			ctr: 0.01,
			position: 2,
		});

		assert.equal(result.eligible, true);
		assert.equal(result.reason, "low_ctr");
	});

	it("does not judge a campaign before twenty landings", () => {
		assert.deepEqual(
			reviewCampaign({ landingVisits: 19, effectiveReads: 9 }),
			{ status: "insufficient_evidence", effectiveReadRate: null },
		);
		assert.deepEqual(
			reviewCampaign({ landingVisits: 25, effectiveReads: 10 }),
			{ status: "ready", effectiveReadRate: 0.4 },
		);
	});

	it("does not present missing growth evidence as zero", () => {
		assert.equal(formatGrowthMetric(null), "证据不足");
		assert.equal(formatGrowthMetric(undefined), "证据不足");
		assert.equal(formatGrowthMetric(""), "证据不足");
		assert.equal(formatGrowthMetric(0), "0");
		assert.equal(formatGrowthMetric(1200, "en-US"), "1,200");
	});

	it("uses a fourteen-day milestone window for Devlog reminders", () => {
		const now = new Date("2026-07-22T00:00:00Z");
		assert.equal(
			shouldRemindDevlog("2026-07-09T23:59:59Z", now),
			false,
		);
		assert.equal(
			shouldRemindDevlog("2026-07-08T00:00:00Z", now),
			true,
		);
	});

	it("keeps long-term game-development evidence above a recent-post spike", () => {
		const ranked = rankTopicCandidates([
			{
				slug: "game-development",
				manualPriority: 1,
				longTermEvidenceCount: 9,
				recentPublishedCount: 1,
			},
			{
				slug: "self-hosting",
				longTermEvidenceCount: 2,
				recentPublishedCount: 12,
			},
		]);

		assert.equal(ranked[0].slug, "game-development");
	});
});
