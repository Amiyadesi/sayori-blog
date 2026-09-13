import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	checkoutSessionForm,
	cleanDisplayName,
	parseDonationAmount,
	parseStripeSignature,
	verifyStripeSignature,
} from "./stripe.js";

describe("stripe helpers", () => {
	it("parses bounded HKD amounts as minor units", () => {
		assert.equal(parseDonationAmount("10"), 1000);
		assert.equal(parseDonationAmount("25.5"), 2550);
		assert.equal(parseDonationAmount("10000.00"), 1_000_000);
		assert.equal(parseDonationAmount("9.99"), null);
		assert.equal(parseDonationAmount("10.001"), null);
		assert.equal(parseDonationAmount("1e3"), null);
	});

	it("normalizes display names without allowing control characters", () => {
		assert.equal(cleanDisplayName("  Alice\n\t<script>  "), "Alice <script>");
		assert.equal(cleanDisplayName(""), "");
	});

	it("builds localized hosted Checkout form fields", () => {
		const form = checkoutSessionForm({
			amountMinor: 2500,
			displayName: "Alice",
			origin: "https://blog.sayori.org",
			pathname: "/en/sponsor/",
		});
		assert.equal(form.get("mode"), "payment");
		assert.equal(form.get("line_items[0][price_data][unit_amount]"), "2500");
		assert.equal(
			form.get("success_url"),
			"https://blog.sayori.org/en/sponsor/success/?session_id={CHECKOUT_SESSION_ID}",
		);
		assert.match(form.get("integration_identifier"), /^sayori_sponsor_[a-z]{8}$/);
	});

	it("verifies Stripe v1 signatures and rejects stale payloads", async () => {
		const payload = '{"id":"evt_test"}';
		const secret = "whsec_test";
		const timestamp = 1_700_000_000;
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const bytes = await crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(`${timestamp}.${payload}`),
		);
		const signature = Array.from(new Uint8Array(bytes), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
		const header = `t=${timestamp},v1=${signature},v0=ignored`;
		assert.deepEqual(parseStripeSignature(header), {
			timestamp,
			signatures: [signature],
		});
		assert.equal(await verifyStripeSignature(payload, header, secret, timestamp), true);
		assert.equal(await verifyStripeSignature(payload, header, secret, timestamp + 301), false);
		assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=bad`, secret, timestamp), false);
	});
});
