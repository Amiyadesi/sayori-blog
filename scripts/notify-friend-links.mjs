import { createHmac } from "node:crypto";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const VISIBILITY_ERRORS = new Set([
	"blog deployment is not live yet",
	"published friend links are not live yet",
]);

export async function notifyFriendLinks({ friends, codeSha, contentSha, secret, fetchImpl = fetch, attempts = 12, delayMs = 5_000 }) {
	if (!secret) throw new Error("FRIEND_NOTIFICATIONS_SECRET is required");
	if (![codeSha, contentSha].every((sha) => /^[a-f0-9]{40}$/.test(sha))) {
		throw new Error("deployment code and content SHA are required");
	}
	const body = JSON.stringify({
		codeSha,
		contentSha,
		friends: friends.map(({ title, siteurl }) => ({ title, siteurl })),
	});
	let response;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		const timestamp = String(Math.floor(Date.now() / 1000));
		const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
		response = await fetchImpl("https://moderation.sayori.org/friends/published", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Sayori-Timestamp": timestamp,
				"X-Sayori-Signature": `sha256=${signature}`,
			},
			body,
			signal: AbortSignal.timeout(60_000),
		});
		if (response.ok) break;
		let reason;
		try {
			const error = await response.json();
			if (VISIBILITY_ERRORS.has(error?.detail)) reason = error.detail;
		} catch (error) {
			// Error responses may be HTML; never expose their body in CI logs.
			if (!(error instanceof SyntaxError)) throw error;
		}
		if (response.status !== 409 || !reason || attempt === attempts) {
			throw new Error(`friend notifications returned HTTP ${response.status}${reason ? `: ${reason}` : ""}`);
		}
		console.log(`[friend-notifications] ${reason}; retry ${attempt + 1}/${attempts}`);
		await delay(delayMs);
	}
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
