import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { notifyFriendLinks } from "./notify-friend-links.mjs";

const options = {
	friends: [{ title: "Friend", siteurl: "https://example.com/", imgurl: "ignored", mail: "private@example.com" }],
	codeSha: "a".repeat(40),
	contentSha: "b".repeat(40),
	secret: "test-secret",
};
const counts = { sent: 1, baseline: 2, alreadySent: 0, unmatched: 0, failed: 0, pending: 0 };

test("signs the published list and includes no application or email fields", async () => {
	const result = await notifyFriendLinks({
		...options,
		fetchImpl: async (url, request) => {
			assert.equal(url, "https://moderation.sayori.org/friends/published");
			assert.deepEqual(JSON.parse(request.body), {
				codeSha: options.codeSha,
				contentSha: options.contentSha,
				friends: [{ title: "Friend", siteurl: "https://example.com/" }],
			});
			const timestamp = request.headers["X-Sayori-Timestamp"];
			const signature = createHmac("sha256", options.secret).update(`${timestamp}.${request.body}`).digest("hex");
			assert.equal(request.headers["X-Sayori-Signature"], `sha256=${signature}`);
			return Response.json(counts);
		},
	});
	assert.deepEqual(result, counts);
});

test("reports authentication and delivery failures without logging private response fields", async () => {
	await assert.rejects(notifyFriendLinks({ ...options, fetchImpl: async () => new Response("private", { status: 401 }) }), /HTTP 401/);
	await assert.rejects(notifyFriendLinks({ ...options, fetchImpl: async () => Response.json({ ...counts, failed: 1 }) }), /rerun/);
	await assert.rejects(notifyFriendLinks({ ...options, secret: "" }), /SECRET is required/);
});

test("retries only deployment visibility conflicts and signs each attempt", async (t) => {
	let calls = 0;
	t.mock.method(Date, "now", () => (1_800_000_000 + calls) * 1000);
	const reasons = ["blog deployment is not live yet", "published friend links are not live yet"];
	const timestamps = [];
	const result = await notifyFriendLinks({
		...options,
		attempts: 3,
		delayMs: 0,
		fetchImpl: async (_, request) => {
			const timestamp = request.headers["X-Sayori-Timestamp"];
			timestamps.push(timestamp);
			assert.equal(request.headers["X-Sayori-Signature"], `sha256=${createHmac("sha256", options.secret).update(`${timestamp}.${request.body}`).digest("hex")}`);
			assert.deepEqual(JSON.parse(request.body).friends, [{ title: "Friend", siteurl: "https://example.com/" }]);
			const reason = reasons[calls++];
			return reason ? Response.json({ detail: reason }, { status: 409 }) : Response.json(counts);
		},
	});
	assert.deepEqual(result, counts);
	assert.equal(calls, 3);
	assert.equal(new Set(timestamps).size, 3);
});

test("persistent visibility conflict still fails after the bounded retry budget", async () => {
	let calls = 0;
	await assert.rejects(notifyFriendLinks({
		...options,
		attempts: 3,
		delayMs: 0,
		fetchImpl: async () => {
			calls++;
			return Response.json({ detail: "published friend links are not live yet" }, { status: 409 });
		},
	}), /HTTP 409: published friend links are not live yet/);
	assert.equal(calls, 3);
});

test("unknown conflicts and non-JSON failures are not retried or exposed", async () => {
	for (const response of [
		Response.json({ detail: "private@example.com" }, { status: 409 }),
		new Response("private@example.com", { status: 409 }),
		Response.json({ detail: "blog deployment is not live yet" }, { status: 401 }),
	]) {
		let calls = 0;
		await assert.rejects(notifyFriendLinks({
			...options,
			delayMs: 0,
			fetchImpl: async () => { calls++; return response; },
		}), (error) => /HTTP (409|401)/.test(error.message) && !error.message.includes("private@example.com"));
		assert.equal(calls, 1);
	}
});
