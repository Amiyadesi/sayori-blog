import assert from "node:assert/strict";
import { test } from "node:test";

const { allowedFriendScreenshotUrls } = await import("../_generated/friend-screenshot-targets.js");
const module = await import("./screenshot.js");

test("normalizes screenshot targets without fragments", () => {
	assert.equal(
		module.normalizeScreenshotTarget("https://example.com/path/#frag"),
		"https://example.com/path/",
	);
	assert.equal(module.normalizeScreenshotTarget("javascript:alert(1)"), "");
	assert.equal(module.normalizeScreenshotTarget("not a url"), "");
});

test("only allows generated friend screenshot targets", () => {
	assert.ok(allowedFriendScreenshotUrls.length > 0);
	assert.equal(module.isAllowedFriendScreenshotUrl(allowedFriendScreenshotUrls[0]), true);
	assert.equal(module.isAllowedFriendScreenshotUrl("https://hidden.example/"), false);
});

test("retries screenshot capture with domcontentloaded after load wait fails", async () => {
	const originalFetch = globalThis.fetch;
	const originalCaches = globalThis.caches;
	const originalWarn = console.warn;
	const requests = [];
	const cachePuts = [];

	globalThis.caches = {
		default: {
			match: async () => undefined,
			put: async (request, response) => {
				cachePuts.push({ request, response });
			},
		},
	};
	console.warn = () => {};
	globalThis.fetch = async (url, options) => {
		requests.push({
			url,
			body: JSON.parse(options.body),
		});
		if (requests.length === 1) {
			return new Response("timeout", { status: 504 });
		}
		return new Response(new Uint8Array([1, 2, 3]), {
			status: 200,
			headers: { "content-type": "image/png" },
		});
	};

	try {
		const target = allowedFriendScreenshotUrls[0];
		const waitUntilTasks = [];
		const response = await module.handleScreenshotRequest({
			request: new Request(`https://blog.sayori.org/api/screenshot?url=${encodeURIComponent(target)}`, {
				headers: { referer: "https://blog.sayori.org/friends/" },
			}),
			env: {
				CF_ACCOUNT_ID: "account-id",
				CF_API_TOKEN: "token",
			},
			waitUntil: (task) => waitUntilTasks.push(task),
		});

		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "image/png");
		assert.equal(requests.length, 2);
		assert.equal(requests[0].body.gotoOptions.waitUntil, "load");
		assert.equal(requests[1].body.gotoOptions.waitUntil, "domcontentloaded");
		assert.equal(requests[0].body.bestAttempt, true);
		assert.equal(requests[0].body.waitForTimeout, 1200);
		assert.equal(new URL(requests[0].url).searchParams.get("cacheTTL"), "3600");
		assert.equal(cachePuts.length, 1);
		assert.match(cachePuts[0].request.url, /\/api\/screenshot-cache\//);
		assert.match(cachePuts[0].request.url, /[?&]v=\d+/);
		assert.equal(waitUntilTasks.length, 1);
		await Promise.all(waitUntilTasks);
	} finally {
		globalThis.fetch = originalFetch;
		globalThis.caches = originalCaches;
		console.warn = originalWarn;
	}
});

test("refresh requests bypass cached screenshots and disable upstream cache", async () => {
	const originalFetch = globalThis.fetch;
	const originalCaches = globalThis.caches;
	const requests = [];
	const cacheMatches = [];
	const cachePuts = [];

	globalThis.caches = {
		default: {
			match: async (request) => {
				cacheMatches.push(request);
				return new Response("cached", {
					status: 200,
					headers: { "content-type": "image/png" },
				});
			},
			put: async (request, response) => {
				cachePuts.push({ request, response });
			},
		},
	};
	globalThis.fetch = async (url, options) => {
		requests.push({
			url,
			body: JSON.parse(options.body),
		});
		return new Response(new Uint8Array([4, 5, 6]), {
			status: 200,
			headers: { "content-type": "image/png" },
		});
	};

	try {
		const target = allowedFriendScreenshotUrls[0];
		const waitUntilTasks = [];
		const response = await module.handleScreenshotRequest({
			request: new Request(
				`https://blog.sayori.org/api/screenshot?url=${encodeURIComponent(target)}&refresh=1`,
				{ headers: { referer: "https://blog.sayori.org/friends/" } },
			),
			env: {
				CF_ACCOUNT_ID: "account-id",
				CF_API_TOKEN: "token",
			},
			waitUntil: (task) => waitUntilTasks.push(task),
		});

		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-sayori-screenshot-refresh"), "true");
		assert.equal(cacheMatches.length, 0);
		assert.equal(requests.length, 1);
		assert.equal(new URL(requests[0].url).searchParams.get("cacheTTL"), "0");
		assert.equal(cachePuts.length, 1);
		await Promise.all(waitUntilTasks);
	} finally {
		globalThis.fetch = originalFetch;
		globalThis.caches = originalCaches;
	}
});
