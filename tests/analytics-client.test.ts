import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { onRequest } from "../functions/_middleware.js";
import { onRequestPost } from "../functions/api/analytics/pageview.js";

const source = fs.readFileSync(
	"src/layouts/partials/AnalyticsScripts.astro",
	"utf8",
);

test("the blog counts the initial page and Astro navigation once without browser identifiers", () => {
	const fetches: [string, RequestInit][] = [];
	const location = { hostname: "blog.sayori.org", pathname: "/" };
	let enabled = true;
	let pageLoad = () => {};
	runInNewContext(
		source.split("<script>")[1].split("</script>")[0]
			.replace(": string | undefined", "").replace("<HTMLMetaElement>", ""),
		{
			location,
			document: {
				querySelector: () => enabled ? { content: "/api/analytics/pageview" } : null,
				addEventListener: (name: string, handler: () => void) => {
					assert.equal(name, "astro:page-load");
					pageLoad = handler;
				},
			},
			fetch: async (url: string, options: RequestInit) => { fetches.push([url, { ...options }]); },
		},
	);
	pageLoad();
	location.pathname = "/fr/";
	pageLoad();
	enabled = false;
	location.pathname = "/admin/";
	pageLoad();
	assert.deepEqual(fetches, Array.from({ length: 2 }, () => [
		"/api/analytics/pageview",
		{ method: "POST", keepalive: true, credentials: "omit", referrerPolicy: "no-referrer" },
	]));
});

test("the public counter rejects foreign requests and binds only the hour even with a request stream", async () => {
	const writes: number[][] = [];
	const endpoint = "https://blog.sayori.org/api/analytics/pageview";
	const env = { SAYORI_ANALYTICS_DB: {
		prepare: (sql: string) => {
			assert.match(sql, /INSERT INTO blog_pageviews/);
			assert.match(sql, /ON CONFLICT\(hour_start\) DO UPDATE SET pageviews = pageviews \+ 1/);
			return { bind: (...params: number[]) => ({ run: async () => writes.push(params) }) };
		},
	} };
	const send = (origin: string, body?: string) => onRequestPost({
		request: new Request(endpoint, {
			method: "POST", body, headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.10" },
		}),
		env,
	});
	assert.equal((await send("https://evil.example")).status, 403);
	assert.equal((await send("https://blog.sayori.org", "")).status, 204);
	assert.equal(writes.length, 1);
	assert.equal(writes[0].length, 1);
	assert.equal(writes[0][0] % 3_600_000, 0);
});

test("HTML opts out of proxy transforms without changing static asset caching", async () => {
	for (const type of ["text/html; charset=utf-8", "text/css"]) {
		const original = new Response("body", { headers: {
			"Content-Type": type,
			"Cache-Control": "public, max-age=60",
		} });
		const result = await onRequest({
			request: new Request("https://blog.sayori.org/fr/"),
			next: async () => original,
		});
		assert.equal(result.headers.get("cache-control"), type.startsWith("text/html")
			? "public, max-age=60, no-transform"
			: "public, max-age=60");
		assert.equal(await result.text(), "body");
	}
});

test("HTML is gzipped for readers that accept it, since no-transform turns off proxy compression", async () => {
	const page = "<!doctype html><title>Sayori</title>" + "<p>书桌上的一页手记。</p>".repeat(200);
	const serve = (request: Request, init: ResponseInit = {}, length = new TextEncoder().encode(page).length) => onRequest({
		request,
		next: async () => new Response(request.method === "HEAD" ? null : page, {
			...init,
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Content-Length": String(length),
				ETag: '"abc"',
			},
		}),
	});
	const url = "https://blog.sayori.org/";
	const edge = (clientAcceptEncoding: string) => Object.assign(
		new Request(url, { headers: { "Accept-Encoding": "br, gzip" } }),
		{ cf: { clientAcceptEncoding } },
	);

	for (const request of [
		new Request(url, { headers: { "Accept-Encoding": "gzip, deflate, br" } }),
		edge("gzip, deflate, br, zstd"),
	]) {
		const result = await serve(request);
		assert.equal(result.headers.get("content-encoding"), "gzip");
		assert.equal(result.headers.get("content-length"), null);
		assert.equal(result.headers.get("vary"), "Accept-Encoding");
		assert.equal(result.headers.get("etag"), 'W/"abc"');
		assert.equal(result.headers.get("cache-control"), "no-transform");
		const compressed = new Uint8Array(await result.arrayBuffer());
		assert.ok(compressed.length < page.length / 4);
		const restored = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
		assert.equal(await new Response(restored).text(), page);
	}

	for (const [request, init, length] of [
		[new Request(url)],
		[new Request(url, { headers: { "Accept-Encoding": "br, gzip;q=0" } })],
		[edge("")],
		[edge("identity")],
		[new Request(url, { method: "HEAD", headers: { "Accept-Encoding": "gzip" } })],
		[new Request(url, { headers: { "Accept-Encoding": "gzip" } }), { status: 404 }],
		[new Request(url, { headers: { "Accept-Encoding": "gzip" } }), {}, 400_001],
	] as [Request, ResponseInit?, number?][]) {
		const result = await serve(request, init, length);
		assert.equal(result.headers.get("content-encoding"), null);
		assert.equal(result.headers.get("etag"), '"abc"');
		assert.equal(result.headers.get("vary"), "Accept-Encoding");
		if (request.method !== "HEAD") assert.equal(await result.text(), page);
	}
});
