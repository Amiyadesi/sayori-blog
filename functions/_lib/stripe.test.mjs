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
	it("parses bounded amounts using each currency's minor unit", () => {
		assert.equal(parseDonationAmount("15"), 1500);
		assert.equal(parseDonationAmount("25.5", "hkd"), 2550);
		assert.equal(parseDonationAmount("2", "usd"), 200);
		assert.equal(parseDonationAmount("10", "cny"), 1000);
		assert.equal(parseDonationAmount("300", "jpy"), 300);
		assert.equal(parseDonationAmount("10000.00", "usd"), 1_000_000);
		assert.equal(parseDonationAmount("14.99", "hkd"), null);
		assert.equal(parseDonationAmount("1.99", "usd"), null);
		assert.equal(parseDonationAmount("10.001", "usd"), null);
		assert.equal(parseDonationAmount("300.5", "jpy"), null);
		assert.equal(parseDonationAmount("1e3"), null);
	});

	it("normalizes display names without allowing control characters", () => {
		assert.equal(
			cleanDisplayName("  Alice\n\t<script>  "),
			"Alice <script>",
		);
		assert.equal(cleanDisplayName(""), "");
	});

	it("builds localized hosted Checkout form fields", () => {
		const form = checkoutSessionForm({
			amountMinor: 2500,
			currency: "usd",
			displayName: "Alice",
			origin: "https://blog.sayori.org",
			pathname: "/en/sponsor/",
		});
		assert.equal(form.get("mode"), "payment");
		assert.equal(form.get("line_items[0][price_data][currency]"), "usd");
		assert.equal(
			form.get("line_items[0][price_data][unit_amount]"),
			"2500",
		);
		assert.equal(form.get("metadata[currency]"), "usd");
		assert.equal(form.get("submit_type"), "donate");
		assert.match(form.get("custom_text[submit][message]"), /Voluntary support/);
		assert.equal(form.get("payment_intent_data[metadata][site]"), "blog");
		assert.equal(
			form.get("payment_intent_data[metadata][supporter_name]"),
			"Alice",
		);
		assert.equal(
			form.get("success_url"),
			"https://blog.sayori.org/en/sponsor/success/?session_id={CHECKOUT_SESSION_ID}",
		);
		assert.match(
			form.get("integration_identifier"),
			/^sayori_sponsor_[a-z]{8}$/,
		);
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
		assert.equal(
			await verifyStripeSignature(payload, header, secret, timestamp),
			true,
		);
		assert.equal(
			await verifyStripeSignature(
				payload,
				header,
				secret,
				timestamp + 301,
			),
			false,
		);
		assert.equal(
			await verifyStripeSignature(
				payload,
				`t=${timestamp},v1=bad`,
				secret,
				timestamp,
			),
			false,
		);
	});
});
