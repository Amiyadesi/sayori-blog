import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { onRequestGet } from "./supporters.js";

describe("public supporters endpoint", () => {
	it("returns only public display fields", async () => {
		let query = "";
		const response = await onRequestGet({
			env: {
				SAYORI_ANALYTICS_DB: {
					prepare(sql) {
						query = sql;
						return {
							all: async () => ({
								results: [
									{
										name: "Alice",
										source: "Stripe",
										createdAt: 1,
										session_id: "cs_secret",
										amount_minor: 2550,
									},
								],
							}),
						};
					},
				},
			},
		});
		assert.equal(response.status, 200);
		const data = await response.json();
		assert.deepEqual(data.supporters, [{ name: "Alice", source: "Stripe", createdAt: 1 }]);
		assert.equal(JSON.stringify(data).includes("cs_secret"), false);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.match(query, /WHERE status = 'active'/);
	});

	it("reports missing D1 explicitly", async () => {
		const response = await onRequestGet({ env: {} });
		assert.equal(response.status, 503);
	});
});
