import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	assertSameOriginPost,
	getAdminPostInteractions,
	getPostInteractions,
	normalizePostPath,
	recordPostInteraction,
} from "./post-interactions.js";

function request({
	method = "GET",
	url = "https://blog.sayori.org/api/post-interactions?path=/posts/hello/",
	origin = "https://blog.sayori.org",
	referer = "",
	rawIp = "203.0.113.10",
	body,
} = {}) {
	const headers = {
		"cf-connecting-ip": rawIp,
		"user-agent": "node-test-agent",
		"accept-language": "zh-CN",
	};
	if (origin) headers.origin = origin;
	if (referer) headers.referer = referer;
	if (body) headers["content-type"] = "application/json";
	return new Request(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
}

function makeD1() {
	const state = {
		totals: new Map(),
		likes: new Set(),
		events: [],
		statements: [],
	};

	const db = {
		state,
		prepare(sql) {
			const statement = {
				sql,
				values: [],
				bind(...values) {
					const expected = (sql.match(/\?/g) || []).length;
					assert.equal(
						values.length,
						expected,
						`bind count mismatch for SQL: ${sql}`,
					);
					statement.values = values;
					state.statements.push({ sql, values });
					return statement;
				},
				first() {
					return runQuery(sql, statement.values, state, "first");
				},
				all() {
					return runQuery(sql, statement.values, state, "all");
				},
				run() {
					return runQuery(sql, statement.values, state, "run");
				},
			};
			return statement;
		},
	};

	return db;
}

function ensureTotal(state, path, now = 1) {
	if (!state.totals.has(path)) {
		state.totals.set(path, {
			likes: 0,
			reward_clicks: 0,
			share_clicks: 0,
			updated_at: now,
		});
	}
	return state.totals.get(path);
}

function runQuery(sql, values, state, mode) {
	if (sql.includes("INSERT INTO post_interaction_totals")) {
		ensureTotal(state, values[0], values[1]);
		return { success: true, meta: { changes: 1 } };
	}

	if (sql.includes("SELECT likes, reward_clicks, share_clicks")) {
		return state.totals.get(values[0]) || null;
	}

	if (sql.includes("SELECT 1 AS liked")) {
		return state.likes.has(`${values[0]}|${values[1]}`)
			? { liked: 1 }
			: null;
	}

	if (sql.includes("INSERT OR IGNORE INTO post_likes")) {
		const key = `${values[0]}|${values[1]}`;
		if (state.likes.has(key)) {
			return { success: true, meta: { changes: 0 } };
		}
		state.likes.add(key);
		return { success: true, meta: { changes: 1 } };
	}

	if (sql.includes("INSERT INTO post_interaction_events")) {
		state.events.push({
			id: values[0],
			path: values[1],
			action: values[2],
			target: values[3],
			visitor_hash: values[4],
			ip_hash: values[5],
			created_at: values[6],
		});
		return { success: true, meta: { changes: 1 } };
	}

	if (sql.includes("SET likes = likes + 1")) {
		const total = ensureTotal(state, values[1], values[0]);
		total.likes += 1;
		total.updated_at = values[0];
		return { success: true, meta: { changes: 1 } };
	}

	if (sql.includes("SET reward_clicks = reward_clicks + 1")) {
		const total = ensureTotal(state, values[1], values[0]);
		total.reward_clicks += 1;
		total.updated_at = values[0];
		return { success: true, meta: { changes: 1 } };
	}

	if (sql.includes("SET share_clicks = share_clicks + 1")) {
		const total = ensureTotal(state, values[1], values[0]);
		total.share_clicks += 1;
		total.updated_at = values[0];
		return { success: true, meta: { changes: 1 } };
	}

	if (sql.includes("COUNT(CASE WHEN action = 'like'")) {
		return summarize(state.events, values[0]);
	}

	if (sql.includes("WHERE created_at >= ? AND action = 'like'")) {
		return rankByAction(state.events, values[0], "like");
	}

	if (sql.includes("WHERE created_at >= ? AND action = 'reward'")) {
		return rankByAction(state.events, values[0], "reward");
	}

	if (sql.includes("WHERE created_at >= ? AND action = 'share'")) {
		return rankByAction(state.events, values[0], "share");
	}

	throw new Error(`Unhandled mock D1 ${mode}: ${sql}`);
}

function summarize(events, start) {
	const rows = events.filter((event) => event.created_at >= start);
	return {
		likes: rows.filter((event) => event.action === "like").length,
		reward_clicks: rows.filter((event) => event.action === "reward").length,
		share_clicks: rows.filter((event) => event.action === "share").length,
		events: rows.length,
	};
}

function rankByAction(events, start, action) {
	const byPath = new Map();
	for (const event of events) {
		if (event.created_at < start || event.action !== action) continue;
		const current = byPath.get(event.path) || {
			path: event.path,
			total: 0,
			events: 0,
			last_interacted_at: 0,
		};
		current.total += 1;
		current.events += 1;
		current.last_interacted_at = Math.max(
			current.last_interacted_at,
			event.created_at,
		);
		byPath.set(event.path, current);
	}
	return {
		results: Array.from(byPath.values()).sort(
			(a, b) =>
				b.total - a.total ||
				b.last_interacted_at - a.last_interacted_at,
		),
	};
}

function env(db) {
	return {
		SAYORI_ANALYTICS_DB: db,
		ANALYTICS_HASH_SECRET: "test-secret",
	};
}

async function readError(responsePromise) {
	const response = await responsePromise.catch((error) => {
		if (error instanceof Response) return error;
		throw error;
	});
	return {
		status: response.status,
		body: await response.json(),
	};
}

describe("post interaction validation", () => {
	it("rejects invalid paths and actions", async () => {
		const db = makeD1();
		const invalidPath = await readError(
			recordPostInteraction({
				request: request({
					method: "POST",
					body: { path: "posts/hello", action: "like" },
				}),
				env: env(db),
			}),
		);
		assert.equal(invalidPath.status, 400);
		assert.equal(invalidPath.body.error, "invalid path");

		const invalidAction = await readError(
			recordPostInteraction({
				request: request({
					method: "POST",
					body: { path: "/posts/hello/?secret=1", action: "clap" },
				}),
				env: env(db),
			}),
		);
		assert.equal(invalidAction.status, 400);
		assert.equal(invalidAction.body.error, "invalid action");
	});

	it("normalizes canonical pathname without query or hash", () => {
		const path = normalizePostPath(
			"https://blog.sayori.org/posts/hello/?token=secret#frag",
			request(),
		);
		assert.equal(path, "/posts/hello/");
	});

	it("blocks cross-site POST requests", async () => {
		let thrown;
		try {
			assertSameOriginPost(
				request({
					method: "POST",
					origin: "https://evil.example",
					body: { path: "/posts/hello/", action: "like" },
				}),
			);
		} catch (error) {
			thrown = error;
		}
		assert.ok(thrown instanceof Response);
		const error = {
			status: thrown.status,
			body: await thrown.json(),
		};
		assert.equal(error.status, 403);
		assert.equal(error.body.error, "origin not allowed");
	});
});

describe("post interaction recording", () => {
	it("dedupes likes for the same visitor and post", async () => {
		const db = makeD1();
		const context = {
			request: request({
				method: "POST",
				body: { path: "/posts/hello/", action: "like" },
			}),
			env: env(db),
		};

		const first = await recordPostInteraction(context);
		const second = await recordPostInteraction({
			...context,
			request: request({
				method: "POST",
				body: { path: "/posts/hello/", action: "like" },
			}),
		});

		assert.equal(first.likes, 1);
		assert.equal(first.changed, true);
		assert.equal(second.likes, 1);
		assert.equal(second.changed, false);
		assert.equal(db.state.events.length, 1);
		assert.equal(db.state.events[0].action, "like");
	});

	it("increments reward and share totals", async () => {
		const db = makeD1();
		await recordPostInteraction({
			request: request({
				method: "POST",
				body: {
					path: "/posts/hello/",
					action: "reward",
					target: "kofi",
				},
			}),
			env: env(db),
		});
		const result = await recordPostInteraction({
			request: request({
				method: "POST",
				body: {
					path: "/posts/hello/",
					action: "share",
					target: "copy",
				},
			}),
			env: env(db),
		});

		assert.equal(result.rewardClicks, 1);
		assert.equal(result.shareClicks, 1);
		assert.equal(db.state.events.length, 2);
	});

	it("never binds raw client IP into D1 statements", async () => {
		const rawIp = "203.0.113.99";
		const db = makeD1();
		await recordPostInteraction({
			request: request({
				method: "POST",
				rawIp,
				body: {
					path: "/posts/hello/",
					action: "share",
					target: "telegram",
				},
			}),
			env: env(db),
		});

		assert.equal(
			db.state.statements.some((statement) =>
				statement.values.includes(rawIp),
			),
			false,
		);
	});

	it("returns GET totals and viewerLiked", async () => {
		const db = makeD1();
		await recordPostInteraction({
			request: request({
				method: "POST",
				body: { path: "/posts/hello/", action: "like" },
			}),
			env: env(db),
		});

		const result = await getPostInteractions({
			request: request(),
			env: env(db),
		});

		assert.equal(result.success, true);
		assert.equal(result.path, "/posts/hello/");
		assert.equal(result.likes, 1);
		assert.equal(result.viewerLiked, true);
	});
});

describe("admin interaction summary", () => {
	it("returns ranking summaries without hashes", async () => {
		const db = makeD1();
		await recordPostInteraction({
			request: request({
				method: "POST",
				body: { path: "/posts/hello/", action: "like" },
			}),
			env: env(db),
		});
		await recordPostInteraction({
			request: request({
				method: "POST",
				body: {
					path: "/posts/hello/",
					action: "share",
					target: "x",
				},
			}),
			env: env(db),
		});

		const result = await getAdminPostInteractions(env(db), {
			range: "30d",
		});

		assert.equal(result.success, true);
		assert.equal(result.summary.likes, 1);
		assert.equal(result.summary.shareClicks, 1);
		assert.equal(result.topLikes[0].path, "/posts/hello/");
		assert.equal(JSON.stringify(result).includes("visitor_hash"), false);
		assert.equal(JSON.stringify(result).includes("ip_hash"), false);
	});
});
