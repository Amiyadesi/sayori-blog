import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { onRequestGet, onRequestOptions } from "./healthz.js";

describe("blog health endpoint", () => {
	it("reports only availability when D1 is reachable", async () => {
		const statements = [];
		const response = await onRequestGet({
			request: new Request("https://blog.sayori.org/api/healthz"),
			env: {
				SAYORI_ANALYTICS_DB: {
					prepare(sql) {
						statements.push(sql);
						return { first: async () => ({ ok: 1 }) };
					},
				},
			},
		});

		assert.equal(response.status, 200);
		assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
		assert.deepEqual(await response.json(), {
			status: "ok",
		});
		assert.deepEqual(statements, ["SELECT 1 AS ok"]);
	});

	it("returns an opaque unavailable response when D1 fails", async () => {
		const response = await onRequestGet({
			request: new Request("https://blog.sayori.org/api/healthz"),
			env: {
				SAYORI_ANALYTICS_DB: {
					prepare() {
						return { first: async () => { throw new Error("private database detail"); } };
					},
				},
			},
		});

		assert.equal(response.status, 503);
		assert.deepEqual(await response.json(), {
			status: "unavailable",
		});
	});

	it("answers CORS preflight without touching D1", async () => {
		const response = await onRequestOptions();
		assert.equal(response.status, 204);
		assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
		assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
	});
});
