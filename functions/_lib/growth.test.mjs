import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	GROWTH_TOPIC_SEEDS,
	annualRollupKey,
	buildAnalysisTasks,
	buildDistributionPackage,
	buildInitialActions,
	normalizeBlogTarget,
	normalizeGrowthQueries,
	retentionCutoffs,
	shouldRunPrune,
} from "./growth.js";

describe("growth worker domain", () => {
	it("uses current public article paths in topic seeds", () => {
		const paths = GROWTH_TOPIC_SEEDS.flatMap((topic) => topic.articlePaths);
		assert.ok(paths.includes("/posts/re0game-dev-life/"));
		assert.ok(
			paths.includes(
				"/posts/student-2c2g-server-service-index/2c2g-server-service-index/",
			),
		);
		assert.ok(
			paths.includes("/posts/cn-internet-community-map/internet-community-map/"),
		);
		assert.equal(paths.some((item) => /%[0-9a-f]{2}/i.test(item)), false);
	});

	it("keeps growth targets on the public blog", () => {
		assert.equal(
			normalizeBlogTarget("/posts/godot-useful-plugins/?x=1#part").href,
			"https://blog.sayori.org/posts/godot-useful-plugins/?x=1",
		);
		assert.throws(() => normalizeBlogTarget("https://example.com/post"), /blog/);
	});

	it("deduplicates bounded Search Gateway queries", () => {
		assert.deepEqual(
			normalizeGrowthQueries([" Godot  插件 ", "godot 插件", "第二条", "第三条", "第四条"]),
			["Godot 插件", "第二条", "第三条"],
		);
		assert.deepEqual(normalizeGrowthQueries([], "Godot Game Jam"), [
			"Godot Game Jam",
			"Godot Game Jam 教程",
			"Godot Game Jam 经验",
		]);
	});

	it("builds an evidence package instead of a cross-platform promo post", () => {
		const pack = buildDistributionPackage({
			target_url: "https://blog.sayori.org/posts/godot-useful-plugins/?ref=keep#plugins",
			source: "v2ex",
			medium: "community",
			campaign: "202607-game-dev",
			content: "thread-op",
			facts: ["完成了三个可复现插件示例"],
			evidence: ["文章内包含仓库链接"],
		});
		const url = new URL(pack.target_url);
		assert.equal(url.searchParams.get("ref"), "keep");
		assert.equal(url.searchParams.get("utm_source"), "v2ex");
		assert.equal(pack.structure.length > 2, true);
		assert.equal("post" in pack, false);
		assert.match(pack.handoff_prompt, /不要自动发布/);
	});

	it("refuses to create a distribution package without facts and evidence", () => {
		assert.throws(
			() => buildDistributionPackage({
				target_url: "https://blog.sayori.org/posts/a/",
				source: "v2ex",
				medium: "community",
				campaign: "202607-a",
				facts: [],
				evidence: [],
			}),
			/至少需要一条可核验事实和一条证据出处/,
		);
	});

	it("derives three state-backed actions without fake analytics", () => {
		const actions = buildInitialActions({
			topics: [
				{
					slug: "game-development",
					status: "draft",
					evidence: ["a", "b", "c", "d"],
				},
			],
			snapshots: [],
			channels: [],
			tasks: [],
		});
		assert.deepEqual(actions.map((item) => item.type), [
			"review_topic",
			"analyze",
			"channel",
		]);
	});

	it("only schedules real campaign reviews and evidence-aware Devlog reminders", () => {
		const now = Date.UTC(2026, 6, 22);
		const base = {
			topics: [
				{
					slug: "game-development",
					title: "游戏开发",
					status: "published",
					evidence: ["长期作品"],
					draft: { lastMilestoneAt: Date.UTC(2026, 6, 8) },
				},
			],
			snapshots: [{}],
			channels: [{}],
			tasks: [],
		};
		const withoutDueCampaign = buildInitialActions(
			{
				...base,
				campaigns: [
					{
						id: "future",
						name: "future",
						status: "published",
						reviewDueAt: now + 1,
					},
				],
			},
			now,
		);
		assert.equal(withoutDueCampaign.some((item) => item.type === "review_campaign"), false);
		assert.match(withoutDueCampaign[0].title, /Devlog/);

		const withDueCampaign = buildInitialActions(
			{
				...base,
				campaigns: [
					{
						id: "due",
						name: "Game Jam",
						status: "published",
						reviewDueAt: now,
						landingVisits: 12,
					},
				],
			},
			now,
		);
		assert.equal(withDueCampaign[0].type, "review_campaign");
		assert.match(withDueCampaign[0].reason, /证据不足/);
	});

	it("creates tasks only from factual GeoScore failures and qualified GSC rows", () => {
		const tasks = buildAnalysisTasks({
			targetUrl: "https://blog.sayori.org/posts/a/",
			topicSlug: "game-development",
			results: {
				geoscore: {
					status: "complete",
					data: {
						failures: [
							{
								id: "geo.extractability",
								title: "正文可提取性",
								severity: "critical",
								evidence: ["正文被脚本隐藏"],
							},
						],
					},
				},
				gsc: {
					status: "complete",
					data: {
						opportunities: [
							{
								query: "godot 插件",
								impressions: 50,
								clicks: 2,
								ctr: 0.04,
								position: 7,
								reason: "position",
							},
						],
					},
				},
			},
		});

		assert.equal(tasks.length, 2);
		assert.equal(tasks[0].priority, "critical");
		assert.equal(tasks[1].kind, "search_opportunity");
	});

	it("uses 30-day snapshots, 180-day details, and daily prune gates", () => {
		const now = Date.UTC(2026, 6, 22);
		const cutoffs = retentionCutoffs(now);
		assert.equal((now - cutoffs.snapshotsBefore) / 86_400_000, 30);
		assert.equal((now - cutoffs.detailsBefore) / 86_400_000, 180);
		assert.equal(shouldRunPrune(now - 86_399_999, now), false);
		assert.equal(shouldRunPrune(now - 86_400_000, now), true);
		assert.equal(annualRollupKey("campaign", now), "2026:campaign");
	});
});
