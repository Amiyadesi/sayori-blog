import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	buildGscWindows,
	normalizeGscRows,
	runGeoScore,
	runSearchGateway,
	runUmami,
} from "./growth-adapters.js";

describe("growth external adapters", () => {
	it("returns explicit not-configured states", async () => {
		assert.equal((await runSearchGateway({ queries: [] }, {}, fetch)).status, "not_configured");
		assert.equal((await runGeoScore({ targetUrl: "https://blog.sayori.org/" }, {}, fetch)).status, "not_configured");
		assert.equal((await runUmami({}, {}, fetch)).status, "not_configured");
	});

	it("sends bounded Search Gateway evidence requests and strips provider internals", async () => {
		let request;
		const result = await runSearchGateway(
			{ queries: ["Godot Game Jam"], locale: "zh-CN" },
			{ SEARCH_GATEWAY_BASE_URL: "https://search.example", SEARCH_GATEWAY_API_KEY: "secret" },
			async (url, init) => {
				request = { url: String(url), init, body: JSON.parse(init.body) };
				return Response.json({
					results: [
						{
							source_id: "src-1",
							title: "Result",
							canonical_url: "https://example.com/a",
							registrable_domain: "example.com",
							snippet: "Useful evidence",
							matched_queries: ["Godot Game Jam"],
							providers: ["brave"],
						},
					],
					provider_runs: [],
					usage: {},
					partial: false,
					degraded: false,
					errors: [],
					limitations: [],
				});
			},
		);

		assert.equal(request.url, "https://search.example/v1/evidence-search");
		assert.equal(request.init.headers.authorization, "Bearer secret");
		assert.equal(request.body.queries.length, 1);
		assert.equal(request.body.budget.max_extract_pages, 3);
		assert.equal(result.status, "complete");
		assert.deepEqual(result.data.results[0].providers, ["brave"]);
	});

	it("maps upstream authentication and timeout failures to opaque stable errors", async () => {
		const env = {
			SEARCH_GATEWAY_BASE_URL: "https://search.example",
			SEARCH_GATEWAY_API_KEY: "secret",
		};
		const auth = await runSearchGateway(
			{ queries: ["test"] },
			env,
			async () => new Response("provider secret detail", { status: 401 }),
		);
		assert.equal(auth.status, "error");
		assert.deepEqual(auth.error, {
			code: "AUTH_FAILED",
			message: "上游鉴权失败",
			retryable: false,
		});
		assert.doesNotMatch(JSON.stringify(auth), /provider secret detail/);

		const timeout = await runSearchGateway(
			{ queries: ["test"] },
			env,
			async () => {
				throw new DOMException("private timeout detail", "AbortError");
			},
		);
		assert.equal(timeout.error.code, "TIMEOUT");
		assert.doesNotMatch(JSON.stringify(timeout), /private timeout detail/);
	});

	it("marks Search Gateway provider errors as partial evidence", async () => {
		const result = await runSearchGateway(
			{ queries: ["test"] },
			{ SEARCH_GATEWAY_BASE_URL: "https://search.example", SEARCH_GATEWAY_API_KEY: "secret" },
			async () => Response.json({ results: [], errors: [{ code: "PROVIDER_FAILED" }] }),
		);
		assert.equal(result.status, "partial");
		assert.equal(result.error.code, "PARTIAL_PROVIDER_FAILURE");
	});

	it("parses the final GeoScore SSE event and keeps only factual failures", async () => {
		const stream = [
			"event: progress\ndata: {\"module\":\"page\"}\n\n",
			"event: complete\ndata: {\"audit_id\":\"audit-123456\",\"score_version\":\"2.4.6\",\"overall_score\":54,\"normalized_checks\":[{\"id\":\"geo.author_signal\",\"status\":\"fail\",\"severity\":\"major\",\"category\":\"geo\",\"localized_title\":{\"zh\":\"内容责任归属\"},\"evidence\":[\"缺少作者\"]},{\"id\":\"geo.predicted_citation\",\"status\":\"fail\",\"predicted\":true}]}\n\n",
		].join("");
		const result = await runGeoScore(
			{ targetUrl: "https://blog.sayori.org/posts/a/" },
			{ GEOSCORE_API_URL: "https://geo.example", GEOSCORE_ADMIN_TOKEN: "secret" },
			async () => new Response(stream, { headers: { "content-type": "text/event-stream" } }),
		);

		assert.equal(result.status, "complete");
		assert.equal(result.data.overallScore, 54);
		assert.deepEqual(result.data.failures.map((item) => item.id), ["geo.author_signal"]);
	});

	it("rejects a GeoScore completion without factual checks", async () => {
		const result = await runGeoScore(
			{ targetUrl: "https://blog.sayori.org/posts/a/" },
			{ GEOSCORE_API_URL: "https://geo.example", GEOSCORE_ADMIN_TOKEN: "secret" },
			async () => new Response("event: complete\ndata: {\"overall_score\":99}\n\n"),
		);
		assert.equal(result.status, "error");
		assert.equal(result.error.code, "INVALID_RESPONSE");
	});

	it("keeps successful Umami evidence when an optional metric is unsupported", async () => {
		const requested = [];
		const result = await runUmami(
			{ targetUrl: "https://blog.sayori.org/posts/a/", startAt: 1, endAt: 2 },
			{ UMAMI_API_URL: "https://stats.example/api", UMAMI_API_TOKEN: "secret", UMAMI_WEBSITE_ID: "site" },
			async (url) => {
				const value = String(url);
				requested.push(value);
				if (value.includes("utm_")) return new Response("unsupported", { status: 400 });
				if (value.includes("type=url")) return Response.json([{ x: "/posts/a/", y: 30 }]);
				if (value.includes("type=event")) return Response.json([{ x: "effective_read", y: 12 }]);
				if (value.includes("type=referrer")) return Response.json([]);
				return Response.json({ pageviews: { value: 30 }, visitors: { value: 22 } });
			},
		);

		assert.equal(result.status, "complete");
		assert.equal(result.data.landingPageviews, 30);
		assert.equal(result.data.effectiveReads, 12);
		assert.equal(result.data.capabilities.campaigns, "unavailable");
		assert.equal(
			requested
				.filter((url) => /type=(event|utm_campaign|utm_source|referrer)/.test(url))
				.every((url) => url.includes("url=%2Fposts%2Fa%2F")),
			true,
		);
	});

	it("measures a campaign with its path and readable UTM dimensions", async () => {
		const requested = [];
		const result = await runUmami(
			{
				targetUrl: "https://blog.sayori.org/posts/a/",
				startAt: 1,
				endAt: 2,
				campaigns: [
					{
						id: "campaign:1",
						name: "202607-game-dev",
						source: "v2ex",
						content: "thread-op",
					},
				],
			},
			{ UMAMI_API_URL: "https://stats.example/api", UMAMI_API_TOKEN: "secret", UMAMI_WEBSITE_ID: "site" },
			async (url) => {
				const value = String(url);
				requested.push(value);
				const parsed = new URL(value);
				const isCampaignMeasurement = parsed.searchParams.get("utmCampaign") === "202607-game-dev";
				if (isCampaignMeasurement && parsed.pathname.endsWith("/stats")) {
					return Response.json({ pageviews: { value: 25 } });
				}
				if (isCampaignMeasurement) {
					return Response.json([{ x: "effective_read", y: 10 }]);
				}
				if (parsed.pathname.endsWith("/stats")) return Response.json({ pageviews: { value: 30 } });
				return Response.json([]);
			},
		);

		assert.equal(result.status, "complete");
		assert.deepEqual(result.data.campaignMetrics[0], {
			id: "campaign:1",
			name: "202607-game-dev",
			source: "v2ex",
			content: "thread-op",
			status: "complete",
			observedAt: result.data.campaignMetrics[0].observedAt,
			landingVisits: 25,
			effectiveReads: 10,
			errorCode: "",
		});
		const campaignUrls = requested.map((value) => new URL(value)).filter(
			(url) => url.searchParams.get("utmCampaign") === "202607-game-dev",
		);
		assert.equal(campaignUrls.length, 2);
		for (const url of campaignUrls) {
			assert.equal(url.searchParams.get("path"), "/posts/a/");
			assert.equal(url.searchParams.get("url"), "/posts/a/");
			assert.equal(url.searchParams.get("utm_campaign"), "202607-game-dev");
			assert.equal(url.searchParams.get("utmSource"), "v2ex");
			assert.equal(url.searchParams.get("utm_content"), "thread-op");
		}
	});

	it("builds delayed 28-day GSC windows and evidence-aware opportunities", () => {
		assert.deepEqual(buildGscWindows(Date.UTC(2026, 6, 22)), {
			current: { startDate: "2026-06-22", endDate: "2026-07-19" },
			previous: { startDate: "2026-05-25", endDate: "2026-06-21" },
		});
		const rows = normalizeGscRows([
			{ keys: ["few", "https://blog.sayori.org/a"], impressions: 19, position: 8 },
			{ keys: ["opportunity", "https://blog.sayori.org/a"], impressions: 50, position: 8, ctr: 0.02 },
		]);
		assert.equal(rows[0].reason, "insufficient_evidence");
		assert.equal(rows[1].opportunity, true);
	});
});
