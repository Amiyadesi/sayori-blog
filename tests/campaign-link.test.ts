import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	buildCampaignUrl,
	createDefaultCampaign,
	mergeRecentCampaignSources,
	normalizeCampaignSource,
	removeRecentCampaignSource,
} from "../src/utils/campaign-link.ts";

describe("campaign link helpers", () => {
	it("normalizes URLs, domains, English names, and Chinese names", () => {
		assert.equal(
			normalizeCampaignSource("https://www.v2ex.com/t/123"),
			"v2ex",
		);
		assert.equal(normalizeCampaignSource("WWW.NodeSeek.com/post"), "nodeseek");
		assert.equal(normalizeCampaignSource("Linux DO"), "linuxdo");
		assert.equal(normalizeCampaignSource("https://linux.do/t/123"), "linuxdo");
		assert.equal(normalizeCampaignSource(" 中文  社区 "), "中文-社区");
	});

	it("builds a stable blog URL while preserving unrelated params and hash", () => {
		const result = buildCampaignUrl({
			target:
				"https://blog.sayori.org/posts/geoscore/?view=full&utm_source=old&utm_content=old#evidence",
			source: "https://www.v2ex.com/t/123",
			medium: "community",
			campaign: "202607 GeoScore 2.4.6",
			content: "Thread OP",
		});
		const url = new URL(result);

		assert.equal(url.origin, "https://blog.sayori.org");
		assert.equal(url.pathname, "/posts/geoscore/");
		assert.equal(url.searchParams.get("view"), "full");
		assert.equal(url.searchParams.get("utm_source"), "v2ex");
		assert.equal(url.searchParams.get("utm_medium"), "community");
		assert.equal(url.searchParams.get("utm_campaign"), "202607-geoscore-2-4-6");
		assert.equal(url.searchParams.get("utm_content"), "thread-op");
		assert.equal(url.hash, "#evidence");
	});

	it("accepts relative blog paths and omits empty optional content", () => {
		const url = new URL(
			buildCampaignUrl({
				target: "/posts/search-gateway/?utm_content=stale",
				source: "知乎",
				medium: "social",
				campaign: "202607-search-gateway",
				content: "",
			}),
		);

		assert.equal(url.origin, "https://blog.sayori.org");
		assert.equal(url.searchParams.get("utm_source"), "知乎");
		assert.equal(url.searchParams.has("utm_content"), false);
	});

	it("rejects invalid or non-blog targets", () => {
		assert.throws(
			() =>
				buildCampaignUrl({
					target: "https://example.com/post",
					source: "v2ex",
					medium: "community",
					campaign: "launch",
				}),
			/博客地址/,
		);
		assert.throws(
			() =>
				buildCampaignUrl({
					target: "/posts/test/",
					source: "",
					medium: "community",
					campaign: "launch",
				}),
			/来源/,
		);
	});

	it("creates monthly campaign defaults from the target slug", () => {
		assert.equal(
			createDefaultCampaign(
				"https://blog.sayori.org/posts/Geo-Score/",
				new Date("2026-07-22T00:00:00Z"),
			),
			"202607-geo-score",
		);
		assert.equal(
			createDefaultCampaign("https://blog.sayori.org/", new Date("2026-07-22")),
			"202607-blog-home",
		);
	});

	it("keeps a deduplicated bounded local source list", () => {
		assert.deepEqual(
			mergeRecentCampaignSources(["linuxdo", "知乎"], "Linux DO", 3),
			["linuxdo", "知乎"],
		);
		assert.deepEqual(
			removeRecentCampaignSource(["linuxdo", "知乎"], "知乎"),
			["linuxdo"],
		);
	});
});
