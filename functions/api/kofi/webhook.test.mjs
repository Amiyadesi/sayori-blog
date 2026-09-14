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

function request(payload, token = "kofi-test-token") {
	const body = new URLSearchParams({ data: JSON.stringify(payload) });
	return new Request("https://blog.sayori.org/api/kofi/webhook", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body,
	});
}

function donationPayload(overrides = {}) {
	return {
		type: "Donation",
		verification_token: "kofi-test-token",
		kofi_transaction_id: "txn_123",
		from_name: "Alice",
		is_public: true,
		amount: "5.00",
		currency: "USD",
		timestamp: "2026-09-13T00:00:00Z",
		...overrides,
	};
}

describe("Ko-fi webhook endpoint", () => {
	it("records public payments once and anonymizes private names", async () => {
		const db = createDb();
		const env = {
			KOFI_VERIFICATION_TOKEN: "kofi-test-token",
			SAYORI_ANALYTICS_DB: db,
		};
		const first = await onRequestPost({
			request: request(donationPayload()),
			env,
		});
		const second = await onRequestPost({
			request: request(donationPayload()),
			env,
		});
		assert.equal(first.status, 200);
		assert.deepEqual(await first.json(), {
			success: true,
			duplicate: false,
			supporterRecorded: true,
		});
		assert.deepEqual(await second.json(), {
			success: true,
			duplicate: true,
			supporterRecorded: false,
		});
		assert.equal(db.batches[0][1].args[1], "Alice");

		const privateResponse = await onRequestPost({
			request: request(
				donationPayload({
					kofi_transaction_id: "txn_private",
					is_public: false,
				}),
			),
			env,
		});
		assert.equal(privateResponse.status, 200);
		assert.equal(db.batches[2][1].args[1], "匿名支持者");
	});

	it("rejects a bad verification token before touching D1", async () => {
		const db = createDb();
		const response = await onRequestPost({
			request: request(donationPayload({ verification_token: "wrong" })),
			env: {
				KOFI_VERIFICATION_TOKEN: "kofi-test-token",
				SAYORI_ANALYTICS_DB: db,
			},
		});
		assert.equal(response.status, 401);
		assert.equal(db.batches.length, 0);
	});

	it("accepts Ko-fi Tip payloads using message_id fallback", async () => {
		const db = createDb();
		const response = await onRequestPost({
			request: request(
				donationPayload({
					type: "Tip",
					kofi_transaction_id: undefined,
					message_id: "msg_456",
				}),
			),
			env: {
				KOFI_VERIFICATION_TOKEN: "kofi-test-token",
				SAYORI_ANALYTICS_DB: db,
			},
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			success: true,
			duplicate: false,
			supporterRecorded: true,
		});
		assert.equal(db.batches[0][0].args[0], "kofi:msg_456");
	});
});
