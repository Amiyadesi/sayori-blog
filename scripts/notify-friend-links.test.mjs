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
