import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	getAdminAnalytics,
	hashValue,
	isAllowedAnalyticsOrigin,
	lookupIpInfo,
	normalizeIpInfoResponse,
	recordAnalyticsEvent,
	sanitizeAnalyticsPayload,
} from "./analytics.js";

function request(origin = "https://blog.sayori.org") {
	return new Request("https://blog.sayori.org/api/analytics/event", {
		headers: origin ? { origin } : {},
	});
}

describe("analytics origin policy", () => {
	it("allows production, preview, and local origins", () => {
		assert.equal(isAllowedAnalyticsOrigin("https://blog.sayori.org"), true);
		assert.equal(isAllowedAnalyticsOrigin("https://sayori.org"), true);
		assert.equal(
			isAllowedAnalyticsOrigin("https://main.sayori-blog.pages.dev"),
			true,
		);
		assert.equal(
			isAllowedAnalyticsOrigin("https://main--sayori-blog.pages.dev"),
			true,
		);
		assert.equal(isAllowedAnalyticsOrigin("http://localhost:4321"), true);
	});

	it("rejects unrelated origins", () => {
		assert.equal(isAllowedAnalyticsOrigin("https://example.com"), false);
		assert.equal(isAllowedAnalyticsOrigin("not a url"), false);
		assert.equal(isAllowedAnalyticsOrigin(""), false);
	});
});

describe("analytics payload sanitation", () => {
	it("keeps only expected fields and strips query strings", () => {
		const payload = sanitizeAnalyticsPayload(
			{
				event: "pageview",
				site: "blog",
				visitorId: "visitor-1234567890",
				sessionId: "session-1234567890",
				path: "https://blog.sayori.org/posts/hello/?token=secret#frag",
				title: " Hello   Sayori ",
				ip: "203.0.113.99",
			},
			request(),
		);

		assert.deepEqual(payload, {
			eventType: "pageview",
			site: "blog",
			visitorId: "visitor-1234567890",
			sessionId: "session-1234567890",
			path: "/posts/hello/",
			title: "Hello Sayori",
		});
	});

	it("derives home site from sayori.org origin when needed", () => {
		const payload = sanitizeAnalyticsPayload(
			{
				event: "heartbeat",
				visitorId: "visitor-1234567890",
				sessionId: "session-1234567890",
				path: "/zh/",
			},
			request("https://sayori.org"),
		);

		assert.equal(payload.site, "home");
		assert.equal(payload.path, "/zh/");
	});
});

describe("analytics hashing", () => {
	it("uses keyed HMAC and changes when secret changes", async () => {
		const first = await hashValue("secret-a", "ip:203.0.113.1");
		const second = await hashValue("secret-a", "ip:203.0.113.1");
		const third = await hashValue("secret-b", "ip:203.0.113.1");

		assert.equal(first, second);
		assert.notEqual(first, third);
		assert.match(first, /^[A-Za-z0-9_-]+$/);
	});
});

describe("D1 event recording", () => {
	it("binds valid statements and never stores the raw client IP", async () => {
		const rawIp = "203.0.113.10";
		const captured = [];
		const db = {
			prepare(sql) {
				return {
					bind(...values) {
						const expected = (sql.match(/\?/g) || []).length;
						assert.equal(
							values.length,
							expected,
							`bind count mismatch for SQL: ${sql}`,
						);
						captured.push({ sql, values });
						return this;
					},
					first() {
						return null;
					},
					run() {
						return { success: true };
					},
				};
			},
		};

		const request = new Request(
			"https://blog.sayori.org/api/analytics/event",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"cf-connecting-ip": rawIp,
					origin: "https://blog.sayori.org",
				},
				body: JSON.stringify({
					event: "pageview",
					site: "blog",
					visitorId: "visitor-1234567890",
					sessionId: "session-1234567890",
					path: "/posts/hello/",
					title: "Hello",
					ip: "198.51.100.22",
				}),
			},
		);

		const result = await recordAnalyticsEvent({
			request,
			env: {
				SAYORI_ANALYTICS_DB: db,
				ANALYTICS_HASH_SECRET: "test-secret",
			},
		});

		assert.equal(result.success, true);
		assert.equal(
			captured.some((statement) =>
				statement.values.some(
					(value) => value === rawIp || value === "198.51.100.22",
				),
			),
			false,
		);
		assert.equal(captured.length, 3);
	});
});

describe("dklyIPdatabase normalization", () => {
	it("normalizes documented location, network, and security fields", () => {
		const info = normalizeIpInfoResponse({
			location: {
				country: { code: "JP", name: "Japan" },
				region: "Tokyo",
				city: "Chiyoda",
			},
			network: {
				asn: "AS15169",
				organization: "Google LLC",
				type: "hosting",
			},
			security: {
				is_vpn: true,
				is_proxy: false,
				is_tor: false,
				is_threat: true,
			},
		});

		assert.deepEqual(info, {
			countryCode: "JP",
			countryName: "Japan",
			region: "Tokyo",
			city: "Chiyoda",
			asn: "AS15169",
			organization: "Google LLC",
			isp: "Google LLC",
			connectionType: "hosting",
			isVpn: true,
			isProxy: false,
			isTor: false,
			isThreat: true,
		});
	});

	it("normalizes China region codes to province names", () => {
		const info = normalizeIpInfoResponse({
			location: {
				country: { code: "CN", name: "China" },
				region: "Guangdong",
				city: "Guangzhou",
			},
			region_code: "GD",
		});

		assert.equal(info.countryCode, "CN");
		assert.equal(info.region, "广东省");
		assert.equal(info.city, "Guangzhou");
	});

	it("treats unknown location placeholders as empty values", () => {
		const info = normalizeIpInfoResponse({
			country_code: "XX",
			country_name: "Unknown",
			region: "Unknown",
			city: "N/A",
		});

		assert.equal(info.countryCode, "");
		assert.equal(info.countryName, "");
		assert.equal(info.region, "");
		assert.equal(info.city, "");
	});

	it("does not treat country names as country codes", () => {
		const info = normalizeIpInfoResponse({
			country: "China",
			region: "Guangdong",
			city: "Guangzhou",
		});

		assert.equal(info.countryCode, "");
		assert.equal(info.countryName, "China");
		assert.equal(info.region, "Guangdong");
		assert.equal(info.city, "Guangzhou");
	});
});

describe("IPInfo cache", () => {
	it("does not reuse expired cache rows when no API key is configured", async () => {
		const db = {
			prepare() {
				return {
					bind() {
						return this;
					},
					first() {
						return {
							ip_hash: "hash",
							country_code: "JP",
							country_name: "Japan",
							expires_at: 1000,
						};
					},
				};
			},
		};

		const info = await lookupIpInfo(
			{ SAYORI_ANALYTICS_DB: db },
			"203.0.113.20",
			"hash",
			2000,
		);

		assert.deepEqual(info, {
			countryCode: "",
			countryName: "",
			region: "",
			city: "",
			asn: "",
			organization: "",
			isp: "",
			connectionType: "",
			isVpn: false,
			isProxy: false,
			isTor: false,
			isThreat: false,
		});
	});

	it("falls back to Cloudflare country, province, and city when dkly is unavailable", async () => {
		const db = {
			prepare() {
				return {
					bind() {
						return this;
					},
					first() {
						return null;
					},
				};
			},
		};

		const info = await lookupIpInfo(
			{ SAYORI_ANALYTICS_DB: db },
			"203.0.113.20",
			"hash",
			2000,
			{
				country: "CN",
				regionCode: "GD",
				region: "Guangdong",
				city: "Guangzhou",
			},
		);

		assert.equal(info.countryCode, "CN");
		assert.equal(info.countryName, "中国");
		assert.equal(info.region, "广东省");
		assert.equal(info.city, "Guangzhou");
	});
});

describe("admin analytics location fields", () => {
	it("returns domestic and foreign province/city breakdowns", async () => {
		const responses = [
			{ pageviews: 2, heartbeats: 0, visitors: 1, sessions: 1 },
			{ online: 1 },
			{ results: [{ site: "blog", events: 2, pageviews: 2, visitors: 1 }] },
			{ results: [] },
			{
				results: [
					{
						site: "blog",
						current_path: "/",
						current_title: "Home",
						last_seen_at: Date.now(),
						pageviews: 1,
						heartbeats: 1,
						country_code: "CN",
						country_name: "China",
						region: "Guangdong",
						city: "Guangzhou",
					},
				],
			},
			{ results: [] },
			{
				results: [
					{
						country_code: "CN",
						country_name: "China",
						pageviews: 2,
						visitors: 1,
					},
					{
						country_code: "JP",
						country_name: "Japan",
						pageviews: 1,
						visitors: 1,
					},
				],
			},
			{
				results: [
					{
						country_code: "CN",
						country_name: "China",
						region: "Guangdong",
						city: "Guangzhou",
						pageviews: 2,
					},
					{
						country_code: "JP",
						country_name: "Japan",
						region: "Tokyo",
						city: "Chiyoda",
						pageviews: 1,
					},
				],
			},
			{ results: [] },
			{ vpn: 0, proxy: 0, tor: 0, threat: 0 },
		];
		const db = {
			prepare() {
				return {
					bind() {
						return this;
					},
					first() {
						return responses.shift();
					},
					all() {
						return responses.shift();
					},
				};
			},
		};

		const data = await getAdminAnalytics(
			{ SAYORI_ANALYTICS_DB: db },
			{ site: "all", range: "1d" },
		);

		assert.equal(data.online[0].locationScope, "domestic");
		assert.equal(data.online[0].region, "广东省");
		assert.equal(data.geoBreakdown.countries[0].locationScope, "domestic");
		assert.equal(data.geoBreakdown.countries[0].countryName, "中国");
		assert.equal(data.geoBreakdown.countries[1].locationScope, "foreign");
		assert.equal(data.geoBreakdown.countries[1].countryName, "日本");
		assert.equal(data.geoBreakdown.cities[0].region, "广东省");
		assert.equal(data.geoBreakdown.cities[1].locationScope, "foreign");
		assert.equal(data.geoBreakdown.cities[1].region, "Tokyo");
		assert.equal(data.geoBreakdown.cities[1].city, "Chiyoda");
	});
});
