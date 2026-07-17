import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyBlogDeployment } from "./verify-live-deployment.mjs";

const expected = {
	codeSha: "1".repeat(40),
	contentSha: "2".repeat(40),
	builtAt: "2026-07-16T04:05:06.000Z",
	workflowRun: "https://github.com/Amiyadesi/sayori-blog/actions/runs/123",
};

test("verifies all public deployment surfaces", async () => {
	const requested = [];
	await verifyBlogDeployment("https://blog.sayori.org", expected, {
		attempts: 1,
		delayMs: 0,
		fetchImpl: async (url, init = {}) => {
			requested.push([url.pathname, init.headers?.Origin || ""]);
			switch (url.pathname) {
				case "/deployment.json":
					return Response.json(expected);
				case "/pagefind/pagefind.js":
					return new Response("x".repeat(101));
				case "/rss.xml":
					return new Response("<rss version=\"2.0\"></rss>");
				case "/api/healthz":
					return Response.json(
						{ status: "ok" },
						{ headers: { "Access-Control-Allow-Origin": "*" } },
					);
				default:
					return new Response(null, { status: 404 });
			}
		},
	});

	assert.deepEqual(requested, [
		["/deployment.json", ""],
		["/pagefind/pagefind.js", ""],
		["/rss.xml", ""],
		["/api/healthz", "https://sayori.org"],
	]);
});

test("retries while the custom domain still serves an older manifest", async () => {
	let manifestRequests = 0;
	await verifyBlogDeployment("https://blog.sayori.org", expected, {
		attempts: 2,
		delayMs: 0,
		fetchImpl: async (url) => {
			if (url.pathname === "/deployment.json") {
				manifestRequests += 1;
				return Response.json({
					...expected,
					codeSha: manifestRequests === 1 ? "stale" : expected.codeSha,
				});
			}
			if (url.pathname === "/pagefind/pagefind.js") return new Response("x".repeat(101));
			if (url.pathname === "/rss.xml") return new Response("<rss></rss>");
			return Response.json(
				{ status: "ok" },
				{ headers: { "Access-Control-Allow-Origin": "*" } },
			);
		},
	});

	assert.equal(manifestRequests, 2);
});
