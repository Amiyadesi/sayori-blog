import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	saveCampaignMeasurements,
	saveGeneratedTasks,
} from "./growth.js";
import {
	upsertGrowthCampaign,
	upsertGrowthChannel,
} from "./growth-store.js";

function recordingDb() {
	const calls = [];
	return {
		calls,
		prepare(sql) {
			const statement = {
				sql,
				bindings: [],
				bind(...bindings) {
					this.bindings = bindings;
					return this;
				},
				async run() {
					calls.push({ sql: this.sql, bindings: this.bindings });
					return { meta: { changes: 1 } };
				},
			};
			return statement;
		},
		async batch(statements) {
			for (const statement of statements) await statement.run();
			return statements.map(() => ({ success: true }));
		},
	};
}

describe("growth D1 writes", () => {
	it("sets publish and review timestamps only when a draft is published", async () => {
		const db = recordingDb();
		await upsertGrowthCampaign(
			db,
			{
				id: "campaign:1",
				name: "202607-game-dev",
				status: "draft",
				source: "v2ex",
				medium: "community",
				targetUrl: "https://blog.sayori.org/posts/a/",
				publishedAt: null,
				reviewDueAt: null,
			},
			1_000,
		);
		assert.equal(db.calls[0].bindings[11], null);
		assert.equal(db.calls[0].bindings[12], null);

		await upsertGrowthCampaign(
			db,
			{
				id: "campaign:1",
				name: "202607-game-dev",
				status: "published",
				source: "v2ex",
				medium: "community",
				targetUrl: "https://blog.sayori.org/posts/a/",
				publishedAt: null,
				reviewDueAt: null,
			},
			2_000,
		);
		assert.equal(db.calls[1].bindings[11], 2_000);
		assert.equal(db.calls[1].bindings[12], 2_000 + 7 * 86_400_000);
	});

	it("keeps an absent channel publish time nullable", async () => {
		const db = recordingDb();
		await upsertGrowthChannel(
			db,
			{
				name: "V2EX",
				source: "v2ex",
				medium: "community",
				lastPublishedAt: null,
			},
			1_000,
		);
		assert.equal(db.calls[0].bindings[8], null);
	});

	it("writes campaign measurements without replacing unavailable values", async () => {
		const db = recordingDb();
		await saveCampaignMeasurements(
			db,
			[
				{
					id: "campaign:1",
					status: "partial",
					observedAt: 1_500,
					landingVisits: 25,
					effectiveReads: null,
					errorCode: "EVENTS_UNAVAILABLE",
				},
			],
			2_000,
		);
		assert.equal(db.calls[0].bindings[0], 25);
		assert.equal(db.calls[0].bindings[1], null);
		assert.match(db.calls[0].bindings[2], /EVENTS_UNAVAILABLE/);
		assert.match(db.calls[0].sql, /COALESCE\(\?, effective_reads\)/);
	});

	it("reopens a completed task when the same failure is observed again", async () => {
		const db = recordingDb();
		await saveGeneratedTasks(db, [
			{
				id: "geo:extractability:/posts/a/",
				kind: "geoscore_failure",
				priority: "critical",
				title: "修复正文可提取性",
				reason: "正文被脚本隐藏",
			},
		]);
		assert.match(db.calls[0].sql, /status=CASE WHEN growth_tasks\.status='done' THEN 'open'/);
		assert.match(db.calls[0].sql, /completed_at=CASE WHEN growth_tasks\.status='done' THEN NULL/);
	});
});
