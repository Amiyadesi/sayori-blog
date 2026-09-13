import { cleanDisplayName } from "./stripe.js";

const ZERO_DECIMAL_CURRENCIES = new Set([
	"bif",
	"clp",
	"djf",
	"gnf",
	"jpy",
	"kmf",
	"krw",
	"mga",
	"pyg",
	"rwf",
	"ugx",
	"vnd",
	"vuv",
	"xaf",
	"xof",
	"xpf",
]);

export function normalizeExternalId(value) {
	const raw = String(value ?? "")
		.replace(/[\u0000-\u001f\u007f]/g, "")
		.trim();
	return raw && raw.length <= 180 ? raw : "";
}

export function normalizeCurrency(value, fallback = "hkd") {
	const currency = String(value || fallback)
		.trim()
		.toLowerCase();
	return /^[a-z]{3}$/.test(currency) ? currency : fallback;
}

export function parseExternalAmount(value, currency) {
	const code = normalizeCurrency(currency);
	const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
	const raw = String(value ?? "").trim();
	const pattern = decimals ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/;
	if (!pattern.test(raw)) return 0;
	const [wholePart, fractionPart = ""] = raw.split(".");
	const minor =
		Number(wholePart) * 10 ** decimals +
		(decimals ? Number(fractionPart.padEnd(decimals, "0")) : 0);
	return Number.isSafeInteger(minor) ? minor : 0;
}

export function supporterDisplayName(value, fallback = "匿名支持者") {
	return cleanDisplayName(value) || fallback;
}

export function buildSupporterBatch(
	db,
	{
		source,
		sourceKey,
		externalId,
		eventType,
		displayName,
		amountMinor,
		currency,
		createdAt,
		now = Date.now(),
	},
) {
	const normalizedId = normalizeExternalId(externalId);
	if (!normalizedId) return null;
	const recordId = `${sourceKey}:${normalizedId}`;
	const created =
		Number.isSafeInteger(createdAt) && createdAt > 0 ? createdAt : now;
	const amount =
		Number.isSafeInteger(amountMinor) && amountMinor >= 0 ? amountMinor : 0;
	const normalizedCurrency = normalizeCurrency(currency);
	return {
		statements: [
			db
				.prepare(
					`INSERT OR IGNORE INTO stripe_webhook_events
						(id, event_type, created_at, processed_at)
					 VALUES (?, ?, ?, ?)`,
				)
				.bind(recordId, `${source}:${eventType}`, created, now),
			db
				.prepare(
					`INSERT OR IGNORE INTO stripe_supporters
						(id, display_name, source, session_id, amount_minor, currency, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					recordId,
					supporterDisplayName(displayName),
					source,
					recordId,
					amount,
					normalizedCurrency,
					created,
				),
		],
	};
}

export function batchWasInserted(result) {
	return Number(result?.meta?.changes || 0) > 0;
}

export { ZERO_DECIMAL_CURRENCIES };
