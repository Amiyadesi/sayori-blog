import { json } from "./admin.js";
import {
	DEFAULT_DONATION_CURRENCY,
	DONATION_CURRENCIES,
	getDonationCurrency,
} from "../../src/data/donation-currencies.js";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const DISPLAY_NAME_MAX_LENGTH = 80;
const SIGNATURE_TOLERANCE_SECONDS = 300;

export function methodNotAllowed(allow) {
	return json(
		{ success: false, error: "method not allowed" },
		{ status: 405, headers: { allow } },
	);
}

export function optionsResponse(allow) {
	return new Response(null, {
		status: 204,
		headers: {
			allow,
			"cache-control": "no-store",
		},
	});
}

export function cleanDisplayName(value) {
	return String(value ?? "")
		.replace(/[\u0000-\u001f\u007f]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function parseDonationAmount(
	value,
	currencyCode = DEFAULT_DONATION_CURRENCY,
) {
	const currency = getDonationCurrency(currencyCode);
	if (!currency) return null;
	const raw = String(value ?? "").trim();
	const pattern = currency.decimals
		? new RegExp(`^\\d+(?:\\.\\d{1,${currency.decimals}})?$`)
		: /^\d+$/;
	if (!pattern.test(raw)) return null;
	const [wholePart, fractionPart = ""] = raw.split(".");
	const whole = Number(wholePart);
	const multiplier = 10 ** currency.decimals;
	const minor =
		whole * multiplier +
		(currency.decimals
			? Number(fractionPart.padEnd(currency.decimals, "0"))
			: 0);
	const minimumMinor = currency.minimum * multiplier;
	const maximumMinor = currency.maximum * multiplier;
	if (
		!Number.isSafeInteger(minor) ||
		minor < minimumMinor ||
		minor > maximumMinor
	) {
		return null;
	}
	return minor;
}

export const DEFAULT_CHECKOUT_ORIGIN = "https://blog.sayori.org";

export function localePrefix(localeOrPath) {
	const value = String(localeOrPath ?? "").trim().toLowerCase();
	if (value === "en" || value === "/en" || value.startsWith("/en/") || value.startsWith("en/")) {
		return "/en";
	}
	return "";
}

export function resolveCheckoutOrigin(env = {}, fallbackOrigin = "") {
	const configured = String(env.STRIPE_CHECKOUT_ORIGIN || "").trim().replace(/\/$/, "");
	if (/^https:\/\/[a-z0-9.-]+$/i.test(configured)) {
		return configured;
	}
	const fallback = String(fallbackOrigin || "").trim().replace(/\/$/, "");
	if (fallback === DEFAULT_CHECKOUT_ORIGIN) {
		return DEFAULT_CHECKOUT_ORIGIN;
	}
	// Prefer production origin; only allow request origin for local/dev hosts.
	if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fallback)) {
		return fallback;
	}
	return DEFAULT_CHECKOUT_ORIGIN;
}

export function checkoutSessionForm({
	amountMinor,
	currency = DEFAULT_DONATION_CURRENCY,
	displayName,
	origin,
	locale = "",
}) {
	const currencyConfig =
		getDonationCurrency(currency) ||
		getDonationCurrency(DEFAULT_DONATION_CURRENCY);
	const form = new URLSearchParams();
	form.set("mode", "payment");
	form.set("line_items[0][quantity]", "1");
	form.set("line_items[0][price_data][currency]", currencyConfig.code);
	form.set("line_items[0][price_data][unit_amount]", String(amountMinor));
	form.set(
		"line_items[0][price_data][product_data][name]",
		"Support Amiya's Desk",
	);
	form.set(
		"line_items[0][price_data][product_data][description]",
		"Voluntary one-time support for Amiya's public blog and projects",
	);
	form.set("submit_type", "donate");
	form.set(
		"custom_text[submit][message]",
		"Voluntary support payment. Check the amount and currency before paying.",
	);
	form.set("custom_fields[0][key]", "supporter_name");
	form.set("custom_fields[0][label][type]", "custom");
	form.set("custom_fields[0][label][custom]", "Display name / 显示名称");
	form.set("custom_fields[0][type]", "text");
	form.set("custom_fields[0][optional]", "true");
	form.set("metadata[site]", "blog");
	form.set("metadata[currency]", currencyConfig.code);
	form.set("metadata[supporter_name]", displayName);
	form.set("payment_intent_data[description]", "Voluntary support for Amiya's public blog and projects");
	form.set("payment_intent_data[metadata][site]", "blog");
	form.set("payment_intent_data[metadata][supporter_name]", displayName);
	form.set(
		"success_url",
		`${origin}${localePrefix(locale)}/sponsor/success/?session_id={CHECKOUT_SESSION_ID}`,
	);
	form.set("cancel_url", `${origin}${localePrefix(locale)}/sponsor/`);
	return form;
}

export async function stripeRequest(env, path, options = {}) {
	if (!env.STRIPE_SECRET_KEY) {
		const error = new Error("Stripe secret is not configured");
		error.code = "missing_secret";
		throw error;
	}

	const headers = {
		accept: "application/json",
		authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
	};
	let body;
	if (options.form) {
		headers["content-type"] = "application/x-www-form-urlencoded";
		body = options.form.toString();
	}
	const response = await fetch(`${STRIPE_API_BASE}${path}`, {
		method: options.method || "GET",
		headers,
		body,
	});
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error("Stripe API request failed");
		error.code = payload?.error?.code || "stripe_api_error";
		error.status = response.status;
		throw error;
	}
	return payload;
}

export function extractSupporterName(session) {
	const customField = Array.isArray(session?.custom_fields)
		? session.custom_fields.find((field) => field?.key === "supporter_name")
		: null;
	return (
		cleanDisplayName(
			customField?.text?.value ||
				customField?.numeric?.value ||
				session?.metadata?.supporter_name ||
				"匿名支持者",
		) || "匿名支持者"
	);
}

export function parseStripeSignature(header) {
	if (!header) return null;
	const values = new Map();
	for (const part of header.split(",")) {
		const separator = part.indexOf("=");
		if (separator <= 0) continue;
		const key = part.slice(0, separator).trim();
		const value = part.slice(separator + 1).trim();
		if (!value) continue;
		if (!values.has(key)) values.set(key, []);
		values.get(key).push(value);
	}
	const timestamp = Number(values.get("t")?.[0]);
	const signatures = values.get("v1") || [];
	if (!Number.isSafeInteger(timestamp) || signatures.length === 0)
		return null;
	return { timestamp, signatures };
}

export async function verifyStripeSignature(
	payload,
	header,
	secret,
	nowSeconds = Math.floor(Date.now() / 1000),
	toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
) {
	if (!secret) return false;
	const parsed = parseStripeSignature(header);
	if (!parsed || Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
		return false;
	}
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${parsed.timestamp}.${payload}`),
	);
	const expected = bytesToHex(new Uint8Array(signature));
	return parsed.signatures.some((candidate) =>
		timingSafeEqual(expected, candidate),
	);
}


function bytesToHex(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function timingSafeEqual(left, right) {
	const normalized = String(right).toLowerCase();
	if (!/^[0-9a-f]+$/.test(normalized) || normalized.length !== left.length) {
		return false;
	}
	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left.charCodeAt(index) ^ normalized.charCodeAt(index);
	}
	return difference === 0;
}

export {
	DISPLAY_NAME_MAX_LENGTH,
	DEFAULT_DONATION_CURRENCY,
	DONATION_CURRENCIES,
	getDonationCurrency,
	SIGNATURE_TOLERANCE_SECONDS,
};
