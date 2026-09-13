import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { onRequestPost } from "./webhook.js";

const SECRET = "whsec_test";

async function signedRequest(event, timestamp = Math.floor(Date.now() / 1000)) {
	const body = JSON.stringify(event);
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const bytes = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${timestamp}.${body}`),
	);
	const signature = Array.from(new Uint8Array(bytes), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return new Request("https://blog.sayori.org/api/stripe/webhook", {
		method: "POST",
		headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
		body,
	});
}

function createDb() {
	const eventIds = new Set();
	const sessions = new Set();
	const batches = [];
	return {
		batches,
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
		async batch(statements) {
			batches.push(statements);
			return statements.map((statement) => {
				if (statement.sql.includes("stripe_webhook_events")) {
					const inserted = !eventIds.has(statement.args[0]);
					if (inserted) eventIds.add(statement.args[0]);
					return { meta: { changes: inserted ? 1 : 0 } };
				}
				const inserted = !sessions.has(statement.args[2]);
				if (inserted) sessions.add(statement.args[2]);
				return { meta: { changes: inserted ? 1 : 0 } };
			});
		},
	};
}

function paidEvent(id = "evt_test_1", sessionId = "cs_test_1") {
		return {
			id,
			type: "checkout.session.completed",
			created: 1_700_000_000,
			data: {
				object: {
					id: sessionId,
					created: 1_700_000_000,
					payment_status: "paid",
					amount_total: 2550,
					currency: "hkd",
					custom_fields: [{ key: "supporter_name", text: { value: "Alice" } }],
				},
			},
		};
}

describe("stripe webhook endpoint", () => {
	it("records paid sessions once and makes replays harmless", async () => {
		const db = createDb();
		const env = { STRIPE_WEBHOOK_SECRET: SECRET, SAYORI_ANALYTICS_DB: db };
		const event = paidEvent();
		const first = await onRequestPost({ request: await signedRequest(event), env });
		const second = await onRequestPost({ request: await signedRequest(event), env });
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
		assert.equal(db.batches.length, 2);
		assert.equal(db.batches[0][1].args[1], "Alice");
	});

	it("rejects invalid signatures without touching D1", async () => {
		const db = createDb();
		const response = await onRequestPost({
			request: new Request("https://blog.sayori.org/api/stripe/webhook", {
				method: "POST",
				headers: { "stripe-signature": "t=1700000000,v1=bad" },
				body: JSON.stringify(paidEvent()),
			}),
			env: { STRIPE_WEBHOOK_SECRET: SECRET, SAYORI_ANALYTICS_DB: db },
		});
		assert.equal(response.status, 400);
		assert.equal(db.batches.length, 0);
	});

	it("does not list completed sessions that are not paid", async () => {
		const db = createDb();
		const event = paidEvent("evt_test_unpaid");
		event.data.object.payment_status = "unpaid";
		const response = await onRequestPost({
			request: await signedRequest(event),
			env: { STRIPE_WEBHOOK_SECRET: SECRET, SAYORI_ANALYTICS_DB: db },
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			success: true,
			duplicate: false,
			supporterRecorded: false,
		});
		assert.equal(db.batches[0].length, 1);
	});
});
