import assert from "node:assert/strict";
import { test } from "node:test";

const module = await import("./friend-updates.js");

test("parses RSS friend feed items", () => {
	const updates = module.parseFriendFeed(
		[
			'<?xml version="1.0"?>',
			'<rss version="2.0"><channel>',
			"<item>",
			"<title><![CDATA[RSS 标题]]></title>",
			"<link>/posts/rss/</link>",
			"<description><![CDATA[<p>RSS 摘要</p>]]></description>",
			"<pubDate>Fri, 26 Jun 2026 06:29:13 GMT</pubDate>",
			"</item>",
			"</channel></rss>",
		].join(""),
		{
			title: "Friend",
			desc: "Desc",
			imgurl: "https://friend.example/avatar.png",
			siteurl: "https://friend.example/",
			feedurl: "https://friend.example/rss.xml",
		},
	);

	assert.equal(updates.length, 1);
	assert.equal(updates[0].title, "RSS 标题");
	assert.equal(updates[0].url, "https://friend.example/posts/rss/");
	assert.equal(updates[0].excerpt, "RSS 摘要");
	assert.equal(updates[0].date, "2026-06-26");
	assert.equal(updates[0].friendTitle, "Friend");
});

test("parses Atom friend feed items", () => {
	const updates = module.parseFriendFeed(
		[
			'<feed xmlns="http://www.w3.org/2005/Atom">',
			"<entry>",
			"<title>Atom 标题</title>",
			'<link href="https://friend.example/atom-post/" rel="alternate"/>',
			"<summary>Atom 摘要</summary>",
			"<updated>2026-06-25T19:46:18.644Z</updated>",
			"</entry>",
			"</feed>",
		].join(""),
		{
			title: "Atom Friend",
			desc: "Desc",
			imgurl: "https://friend.example/avatar.png",
			siteurl: "https://friend.example/",
			feedurl: "https://friend.example/atom.xml",
		},
	);

	assert.equal(updates.length, 1);
	assert.equal(updates[0].title, "Atom 标题");
	assert.equal(updates[0].url, "https://friend.example/atom-post/");
	assert.equal(updates[0].excerpt, "Atom 摘要");
	assert.equal(updates[0].date, "2026-06-25");
	assert.equal(updates[0].friendTitle, "Atom Friend");
});

test("loads live updates through the API and caches the response", async () => {
	const originalFetch = globalThis.fetch;
	const originalCaches = globalThis.caches;
	const cachePuts = [];

	globalThis.caches = {
		default: {
			match: async () => undefined,
			put: async (request, response) => {
				cachePuts.push({ request, response });
			},
		},
	};
	globalThis.fetch = async (url) => {
		if (String(url).includes("ftz.is-a.dev/rss.xml")) {
			return new Response(
				'<rss><channel><item><title>FTZ Post</title><link>https://ftz.is-a.dev/blog/posts/test/</link><description>New post</description><pubDate>Fri, 26 Jun 2026 00:00:00 GMT</pubDate></item></channel></rss>',
				{ status: 200, headers: { "content-type": "application/xml" } },
			);
		}
		return new Response("not found", { status: 404 });
	};

	try {
		const waitUntilTasks = [];
		const response = await module.handleFriendUpdatesRequest({
			request: new Request("https://blog.sayori.org/api/friend-updates?limit=12"),
			waitUntil: (task) => waitUntilTasks.push(task),
		});
		const data = await response.json();

		assert.equal(response.status, 200);
		assert.equal(data.success, true);
		assert.ok(data.updates.some((item) => item.title === "FTZ Post"));
		assert.equal(cachePuts.length, 1);
		assert.equal(waitUntilTasks.length, 1);
		await Promise.all(waitUntilTasks);
	} finally {
		globalThis.fetch = originalFetch;
		globalThis.caches = originalCaches;
	}
});

test("bypasses friend update cache when fresh is requested", async () => {
	const originalFetch = globalThis.fetch;
	const originalCaches = globalThis.caches;
	let matchCount = 0;
	let putCount = 0;

	globalThis.caches = {
		default: {
			match: async () => {
				matchCount += 1;
				return new Response(
					JSON.stringify({
						success: true,
						updatedAt: "2026-06-01T00:00:00.000Z",
						updates: [
							{
								title: "Cached Post",
								url: "https://cached.example/post",
							},
						],
					}),
					{ headers: { "content-type": "application/json" } },
				);
			},
			put: async () => {
				putCount += 1;
			},
		},
	};
	globalThis.fetch = async (url) => {
		if (String(url).includes("ftz.is-a.dev/rss.xml")) {
			return new Response(
				'<rss><channel><item><title>Fresh Post</title><link>https://ftz.is-a.dev/blog/posts/fresh/</link><description>Fresh update</description><pubDate>Fri, 26 Jun 2026 00:00:00 GMT</pubDate></item></channel></rss>',
				{ status: 200, headers: { "content-type": "application/xml" } },
			);
		}
		return new Response("not found", { status: 404 });
	};

	try {
		const response = await module.handleFriendUpdatesRequest({
			request: new Request("https://blog.sayori.org/api/friend-updates?limit=12&fresh=1"),
			waitUntil: () => {},
		});
		const data = await response.json();

		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(matchCount, 0);
		assert.equal(putCount, 0);
		assert.ok(data.updates.some((item) => item.title === "Fresh Post"));
		assert.ok(!data.updates.some((item) => item.title === "Cached Post"));
	} finally {
		globalThis.fetch = originalFetch;
		globalThis.caches = originalCaches;
	}
});
