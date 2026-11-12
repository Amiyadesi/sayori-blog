import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkRateLimit } from "./rate-limit.js";

function fakeDb(initialCount = 0) {
	const state = { count: initialCount, inserts: 0, deletes: 0 };
	return {
		state,
		prepare(sql) {
			const stmt = {
				params: [],
				bind(...args) {
					stmt.params = args;
					return stmt;
				},
				async first() {
					if (sql.includes("COUNT(*)")) return { n: state.count };
					return null;
				},
				async run() {
					if (sql.includes("INSERT")) state.inserts += 1;
					if (sql.includes("DELETE")) state.deletes += 1;
					return { success: true };
				},
			};
			return stmt;
		},
	};
}

function request() {
	return new Request("https://blog.sayori.org/api/stripe/checkout", {
		method: "POST",
		headers: { "cf-connecting-ip": "203.0.113.7" },
	});
}

const options = {
	table: "stripe_checkout_requests",
	limit: 5,
	windowSeconds: 60,
};

describe("checkRateLimit", () => {
	it("allows and records a request below the limit", async () => {
		const db = fakeDb(2);
		const result = await checkRateLimit(
			{ SAYORI_ANALYTICS_DB: db },
			request(),
			options,
		);
		assert.equal(result.allowed, true);
		assert.equal(db.state.inserts, 1);
	});

	it("blocks once the window is full and records nothing", async () => {
		const db = fakeDb(5);
		const result = await checkRateLimit(
			{ SAYORI_ANALYTICS_DB: db },
			request(),
			options,
		);
		assert.equal(result.allowed, false);
		assert.equal(result.retryAfterSeconds, 60);
		assert.equal(db.state.inserts, 0);
	});

	it("hashes the client IP instead of storing it raw", async () => {
		const seen = [];
		const db = fakeDb(0);
		const original = db.prepare;
		db.prepare = (sql) => {
			const stmt = original(sql);
			const bind = stmt.bind;
			stmt.bind = (...args) => {
				seen.push(...args);
				return bind(...args);
			};
			return stmt;
		};
		await checkRateLimit({ SAYORI_ANALYTICS_DB: db }, request(), options);
		assert.ok(
			seen.every((value) => value !== "203.0.113.7"),
			"raw IP must not reach the database",
		);
	});

	it("allows when no database binding is present", async () => {
		const result = await checkRateLimit({}, request(), options);
		assert.equal(result.allowed, true);
	});
});
