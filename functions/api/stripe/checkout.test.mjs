import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { onRequestPost } from "./checkout.js";

function context(body, env = {}) {
	return {
		request: new Request("https://blog.sayori.org/api/stripe/checkout", {
			method: "POST",
			headers: {
				origin: "https://blog.sayori.org",
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
		}),
		env,
	};
}

describe("stripe checkout endpoint", () => {
	it("creates a hosted session and returns only its URL", async () => {
		const previousFetch = globalThis.fetch;
		let requestBody = "";
		globalThis.fetch = async (_url, options) => {
			requestBody = options.body;
			return new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/cs_test" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};
		try {
			const response = await onRequestPost(
				context({ amount: "25.50", name: "Alice" }, { STRIPE_SECRET_KEY: "sk_test_secret" }),
			);
			assert.equal(response.status, 200);
			assert.deepEqual(await response.json(), {
				success: true,
				url: "https://checkout.stripe.com/cs_test",
			});
			assert.match(requestBody, /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=2550/);
			assert.match(requestBody, /metadata%5Bsite%5D=blog/);
			assert.doesNotMatch(requestBody, /payment_method_types/);
		} finally {
			globalThis.fetch = previousFetch;
		}
	});

	it("rejects invalid amounts before calling Stripe", async () => {
		const response = await onRequestPost(
			context({ amount: "1.00" }, { STRIPE_SECRET_KEY: "sk_test_secret" }),
		);
		assert.equal(response.status, 400);
		assert.equal((await response.json()).success, false);
	});

	it("rejects cross-origin form posts", async () => {
		const request = new Request("https://blog.sayori.org/api/stripe/checkout", {
			method: "POST",
			headers: {
				origin: "https://evil.example",
				"content-type": "application/json",
			},
			body: JSON.stringify({ amount: "25" }),
		});
		const response = await onRequestPost({ request, env: { STRIPE_SECRET_KEY: "sk_test_secret" } });
		assert.equal(response.status, 403);
	});
});
