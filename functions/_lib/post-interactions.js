import { getClientIp, hashValue } from "./analytics.js";

const ALLOWED_ACTIONS = new Set(["like", "reward", "share"]);
const ALLOWED_TARGETS = new Set([
	"like",
	"kofi",
	"afdian",
	"copy",
	"weibo",
	"x",
	"telegram",
	"facebook",
	"native",
	"poster",
]);
const ALLOWED_RANGES = new Map([
	["7d", 7 * 24 * 60 * 60 * 1000],
	["30d", 30 * 24 * 60 * 60 * 1000],
]);

const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"cache-control": "no-store",
};

function json(data, init = {}) {
	const headers = new Headers(JSON_HEADERS);
	if (init.headers) {
		new Headers(init.headers).forEach((value, key) =>
			headers.set(key, value),
		);
	}
	return new Response(JSON.stringify(data), {
		status: init.status || 200,
		headers,
	});
}

export function postInteractionJson(data, init = {}) {
	return json(data, init);
}

export function handlePostInteractionError(error) {
	if (error instanceof Response) {
		return error;
	}
	console.error("[post-interactions]", error);
	return json(
		{ success: false, error: "post interaction API failed" },
		{ status: 500 },
	);
}

function cleanString(value, maxLength) {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLength);
}

function responseError(message, status = 400) {
	throw json({ success: false, error: message }, { status });
}

function requireEnv(env) {
	if (!env.SAYORI_ANALYTICS_DB) {
		throw new Error("Cloudflare missing SAYORI_ANALYTICS_DB binding");
	}
	if (!env.ANALYTICS_HASH_SECRET) {
		throw new Error("Cloudflare missing ANALYTICS_HASH_SECRET secret");
	}
}

function requestOrigin(request) {
	return new URL(request.url).origin;
}

export function assertSameOriginPost(request) {
	const expectedOrigin = requestOrigin(request);
	const origin = request.headers.get("origin");
	if (origin) {
		if (origin !== expectedOrigin) {
			responseError("origin not allowed", 403);
		}
		return;
	}

	const referer = request.headers.get("referer");
	if (!referer) {
		responseError("origin required", 403);
	}
	try {
		if (new URL(referer).origin !== expectedOrigin) {
			responseError("origin not allowed", 403);
		}
	} catch {
		responseError("invalid referer", 403);
	}
}

export function normalizePostPath(value, request) {
	const raw = cleanString(value, 500);
	if (!raw) responseError("invalid path");
	if (/[\r\n]/.test(raw)) responseError("invalid path");

	let pathname = "";
	if (raw.startsWith("/")) {
		try {
			pathname = new URL(raw, requestOrigin(request)).pathname;
		} catch {
			responseError("invalid path");
		}
	} else if (/^https?:\/\//i.test(raw)) {
		try {
			pathname = new URL(raw).pathname;
		} catch {
			responseError("invalid path");
		}
	} else {
		responseError("invalid path");
	}

	pathname = cleanString(pathname, 300);
	if (!pathname || !pathname.startsWith("/") || pathname.length > 300) {
		responseError("invalid path");
	}
	return pathname;
}

function normalizeAction(value) {
	const action = cleanString(value, 20).toLowerCase();
	if (!ALLOWED_ACTIONS.has(action)) {
		responseError("invalid action");
	}
	return action;
}

function normalizeTarget(value, action) {
	const fallback = action === "like" ? "like" : "";
	const target = cleanString(value || fallback, 40).toLowerCase();
	if (!target || !ALLOWED_TARGETS.has(target)) {
		responseError("invalid target");
	}
	if (action === "reward" && target !== "kofi" && target !== "afdian") {
		responseError("invalid target");
	}
	if (
		action === "share" &&
		![
			"copy",
			"weibo",
			"x",
			"telegram",
			"facebook",
			"native",
			"poster",
		].includes(target)
	) {
		responseError("invalid target");
	}
	if (action === "like" && target !== "like") {
		responseError("invalid target");
	}
	return target;
}

function getVisitorFingerprint(request) {
	return [
		getClientIp(request),
		cleanString(request.headers.get("user-agent"), 240),
		cleanString(request.headers.get("accept-language"), 120),
	].join("|");
}

async function getVisitorHashes(env, request) {
	const fingerprint = getVisitorFingerprint(request);
	const visitorHash = await hashValue(
		env.ANALYTICS_HASH_SECRET,
		`post-interaction-visitor:${fingerprint}`,
	);
	const ipHash = await hashValue(
		env.ANALYTICS_HASH_SECRET,
		`ip:${getClientIp(request)}`,
	);
	return { visitorHash, ipHash };
}

function totalsFromRow(path, row, viewerLiked = false) {
	return {
		success: true,
		path,
		likes: Number(row?.likes || 0),
		rewardClicks: Number(row?.reward_clicks || 0),
		shareClicks: Number(row?.share_clicks || 0),
		viewerLiked,
	};
}

async function ensureTotalsRow(db, path, now) {
	await db
		.prepare(
			`INSERT INTO post_interaction_totals (
				path, likes, reward_clicks, share_clicks, updated_at
			) VALUES (?, 0, 0, 0, ?)
			ON CONFLICT(path) DO NOTHING`,
		)
		.bind(path, now)
		.run();
}

async function readTotals(db, path) {
	return await db
		.prepare(
			`SELECT likes, reward_clicks, share_clicks
			FROM post_interaction_totals
			WHERE path = ?`,
		)
		.bind(path)
		.first();
}

async function viewerLiked(db, path, visitorHash) {
	const row = await db
		.prepare(
			`SELECT 1 AS liked
			FROM post_likes
			WHERE path = ? AND visitor_hash = ?`,
		)
		.bind(path, visitorHash)
		.first();
	return Boolean(row?.liked);
}

export async function getPostInteractions(context) {
	const { env, request } = context;
	requireEnv(env);
	const url = new URL(request.url);
	const path = normalizePostPath(url.searchParams.get("path"), request);
	const { visitorHash } = await getVisitorHashes(env, request);
	const [totals, liked] = await Promise.all([
		readTotals(env.SAYORI_ANALYTICS_DB, path),
		viewerLiked(env.SAYORI_ANALYTICS_DB, path, visitorHash),
	]);
	return totalsFromRow(path, totals, liked);
}

async function recordInteractionEvent(db, values) {
	await db
		.prepare(
			`INSERT INTO post_interaction_events (
				id, path, action, target, visitor_hash, ip_hash, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			values.id,
			values.path,
			values.action,
			values.target,
			values.visitorHash,
			values.ipHash,
			values.now,
		)
		.run();
}

async function recordLike(db, event) {
	const result = await db
		.prepare(
			`INSERT OR IGNORE INTO post_likes (
				path, visitor_hash, created_at
			) VALUES (?, ?, ?)`,
		)
		.bind(event.path, event.visitorHash, event.now)
		.run();
	const inserted = Number(result?.meta?.changes || 0) > 0;
	if (!inserted) return false;

	await recordInteractionEvent(db, event);
	await db
		.prepare(
			`UPDATE post_interaction_totals
			SET likes = likes + 1, updated_at = ?
			WHERE path = ?`,
		)
		.bind(event.now, event.path)
		.run();
	return true;
}

async function recordRewardOrShare(db, event) {
	await recordInteractionEvent(db, event);
	const column = event.action === "reward" ? "reward_clicks" : "share_clicks";
	await db
		.prepare(
			`UPDATE post_interaction_totals
			SET ${column} = ${column} + 1, updated_at = ?
			WHERE path = ?`,
		)
		.bind(event.now, event.path)
		.run();
	return true;
}

export async function recordPostInteraction(context) {
	const { env, request } = context;
	requireEnv(env);
	assertSameOriginPost(request);
	const payload = await request.json().catch(() => ({}));
	const path = normalizePostPath(payload.path, request);
	const action = normalizeAction(payload.action);
	const target = normalizeTarget(payload.target, action);
	const now = Date.now();
	const { visitorHash, ipHash } = await getVisitorHashes(env, request);
	const db = env.SAYORI_ANALYTICS_DB;

	await ensureTotalsRow(db, path, now);

	const event = {
		id: crypto.randomUUID(),
		path,
		action,
		target,
		visitorHash,
		ipHash,
		now,
	};
	const changed =
		action === "like"
			? await recordLike(db, event)
			: await recordRewardOrShare(db, event);
	const totals = await readTotals(db, path);
	return {
		...totalsFromRow(
			path,
			totals,
			action === "like" || (await viewerLiked(db, path, visitorHash)),
		),
		changed,
	};
}

function normalizeRange(value) {
	const range = cleanString(value || "7d", 20).toLowerCase();
	return ALLOWED_RANGES.has(range) ? range : "7d";
}

function mapRankRow(row) {
	return {
		path: row.path,
		total: Number(row.total || 0),
		events: Number(row.events || row.total || 0),
		lastInteractedAt: Number(row.last_interacted_at || 0),
	};
}

export function normalizeAdminInteractionQuery(url) {
	return { range: normalizeRange(url.searchParams.get("range")) };
}

export async function getAdminPostInteractions(env, options = {}) {
	requireEnv(env);
	const db = env.SAYORI_ANALYTICS_DB;
	const range = normalizeRange(options.range);
	const now = Date.now();
	const start = now - (ALLOWED_RANGES.get(range) || ALLOWED_RANGES.get("7d"));

	const summary = await db
		.prepare(
			`SELECT
				COUNT(CASE WHEN action = 'like' THEN 1 END) AS likes,
				COUNT(CASE WHEN action = 'reward' THEN 1 END) AS reward_clicks,
				COUNT(CASE WHEN action = 'share' THEN 1 END) AS share_clicks,
				COUNT(*) AS events
			FROM post_interaction_events
			WHERE created_at >= ?`,
		)
		.bind(start)
		.first();

	const likes = await db
		.prepare(
			`SELECT path, COUNT(*) AS total, COUNT(*) AS events,
				MAX(created_at) AS last_interacted_at
			FROM post_interaction_events
			WHERE created_at >= ? AND action = 'like'
			GROUP BY path
			ORDER BY total DESC, last_interacted_at DESC
			LIMIT 20`,
		)
		.bind(start)
		.all();

	const rewards = await db
		.prepare(
			`SELECT path, COUNT(*) AS total, COUNT(*) AS events,
				MAX(created_at) AS last_interacted_at
			FROM post_interaction_events
			WHERE created_at >= ? AND action = 'reward'
			GROUP BY path
			ORDER BY total DESC, last_interacted_at DESC
			LIMIT 20`,
		)
		.bind(start)
		.all();

	const shares = await db
		.prepare(
			`SELECT path, COUNT(*) AS total, COUNT(*) AS events,
				MAX(created_at) AS last_interacted_at
			FROM post_interaction_events
			WHERE created_at >= ? AND action = 'share'
			GROUP BY path
			ORDER BY total DESC, last_interacted_at DESC
			LIMIT 20`,
		)
		.bind(start)
		.all();

	return {
		success: true,
		query: { range, generatedAt: now },
		summary: {
			likes: Number(summary?.likes || 0),
			rewardClicks: Number(summary?.reward_clicks || 0),
			shareClicks: Number(summary?.share_clicks || 0),
			events: Number(summary?.events || 0),
		},
		topLikes: (likes.results || []).map(mapRankRow),
		topRewards: (rewards.results || []).map(mapRankRow),
		topShares: (shares.results || []).map(mapRankRow),
	};
}
