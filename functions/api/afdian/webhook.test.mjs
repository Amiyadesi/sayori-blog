import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { onRequestPost } from "./webhook.js";

function createDb() {
	const eventIds = new Set();
	const supporterIds = new Set();
	const batches = [];
	return {
		batches,
		async batch(statements) {
			batches.push(statements);
			return statements.map((statement) => {
				const id = statement.args[0];
				const seen = statement.sql.includes("stripe_webhook_events")
					? eventIds
					: supporterIds;
				const inserted = !seen.has(id);
				if (inserted) seen.add(id);
				return { meta: { changes: inserted ? 1 : 0 } };
			});
		},
		prepare(sql) {
			return {
				sql,
				args: [],
				bind(...args) {
					this.args = args;
					return this;
				},
			};
		},
	};
}

function request(payload, token = "afdian-test-token") {
	return new Request(
		`https://blog.sayori.org/api/afdian/webhook?token=${token}`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		},
	);
}

function orderPayload(overrides = {}) {
	return {
		ec: 200,
		data: {
			type: "order",
			order: {
				out_trade_no: "afd_order_123",
				user_id: "afd_user_456",
				status: 2,
				total_amount: "20.00",
				...overrides,
			},
		},
	};
}

describe("Afdian webhook endpoint", () => {
	it("records paid orders once", async () => {
		const db = createDb();
		const env = {
			AFDIAN_WEBHOOK_TOKEN: "afdian-test-token",
			SAYORI_ANALYTICS_DB: db,
		};
		const first = await onRequestPost({
			request: request(orderPayload()),
			env,
		});
		const second = await onRequestPost({
			request: request(orderPayload()),
			env,
		});
		assert.equal(first.status, 200);
		assert.deepEqual(await first.json(), {
			ec: 200,
			em: "ok",
			success: true,
			duplicate: false,
			supporterRecorded: true,
		});
		assert.deepEqual(await second.json(), {
			ec: 200,
			em: "ok",
			success: true,
			duplicate: true,
			supporterRecorded: false,
		});
		assert.equal(db.batches[0][1].args[1], "爱发电用户_user_456");
	});

	it("rejects a bad token and ignores unpaid orders", async () => {
		const db = createDb();
		const env = {
			AFDIAN_WEBHOOK_TOKEN: "afdian-test-token",
			SAYORI_ANALYTICS_DB: db,
		};
		const bad = await onRequestPost({
			request: request(orderPayload(), "wrong"),
			env,
		});
		assert.equal(bad.status, 401);
		assert.equal(db.batches.length, 0);
		const unpaid = await onRequestPost({
			request: request(
				orderPayload({ out_trade_no: "afd_unpaid", status: 1 }),
				"afdian-test-token",
			),
			env,
		});
		assert.equal(unpaid.status, 200);
		assert.deepEqual(await unpaid.json(), {
			ec: 200,
			em: "ok",
			success: true,
			ignored: true,
			reason: "order not paid",
		});
		assert.equal(db.batches.length, 0);
	});
});
