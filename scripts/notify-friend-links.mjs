import { createHmac } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function notifyFriendLinks({ friends, codeSha, contentSha, secret, fetchImpl = fetch }) {
	if (!secret) throw new Error("FRIEND_NOTIFICATIONS_SECRET is required");
	if (![codeSha, contentSha].every((sha) => /^[a-f0-9]{40}$/.test(sha))) {
		throw new Error("deployment code and content SHA are required");
	}
	const body = JSON.stringify({
		codeSha,
		contentSha,
		friends: friends.map(({ title, siteurl }) => ({ title, siteurl })),
	});
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
	const response = await fetchImpl("https://moderation.sayori.org/friends/published", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Sayori-Timestamp": timestamp,
			"X-Sayori-Signature": `sha256=${signature}`,
		},
		body,
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok) throw new Error(`friend notifications returned HTTP ${response.status}`);
	const result = await response.json();
	const counts = {};
	for (const field of ["sent", "baseline", "alreadySent", "unmatched", "failed", "pending"]) {
		if (!Number.isInteger(result[field]) || result[field] < 0) {
			throw new Error("invalid friend notification response");
		}
		counts[field] = result[field];
	}
	console.log(`[friend-notifications] ${JSON.stringify(counts)}`);
	if (counts.failed || counts.pending) {
		throw new Error("Friend notification delivery is incomplete; rerun this deployment to retry.");
	}
	return counts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { friendUpdateSources } = await import("../functions/_generated/friend-update-sources.js");
	await notifyFriendLinks({
		friends: friendUpdateSources,
		codeSha: process.env.DEPLOYMENT_CODE_SHA,
		contentSha: process.env.DEPLOYMENT_CONTENT_SHA,
		secret: process.env.FRIEND_NOTIFICATIONS_SECRET,
	});
}
