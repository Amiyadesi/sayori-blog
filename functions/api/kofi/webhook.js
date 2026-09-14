import { json } from "../../_lib/admin.js";
import {
	batchWasInserted,
	buildSupporterBatch,
	normalizeCurrency,
	parseExternalAmount,
	supporterDisplayName,
} from "../../_lib/supporters.js";
import { methodNotAllowed, optionsResponse } from "../../_lib/stripe.js";

const MAX_BODY_LENGTH = 200_000;
const SUPPORTED_TYPES = new Set([
	"Tip",
	"Donation",
	"Subscription",
	"Membership",
	"Shop Order",
	"Commission",
]);

export async function onRequestPost({ request, env }) {
	try {
		if (!env.KOFI_VERIFICATION_TOKEN || !env.SAYORI_ANALYTICS_DB) {
			return json(
				{ success: false, error: "Ko-fi webhook 暂未配置" },
				{ status: 503 },
			);
		}
		const rawBody = await request.text();
		if (rawBody.length > MAX_BODY_LENGTH) {
			return json(
				{ success: false, error: "payload too large" },
				{ status: 413 },
			);
		}
		const form = new URLSearchParams(rawBody);
		const encodedData = form.get("data");
		if (!encodedData) {
			return json(
				{ success: false, error: "invalid Ko-fi payload" },
				{ status: 400 },
			);
		}
		const payload = JSON.parse(encodedData);
		if (
			!timingSafeEqualText(
				payload?.verification_token,
				env.KOFI_VERIFICATION_TOKEN,
			)
		) {
			return json(
				{ success: false, error: "invalid Ko-fi verification token" },
				{ status: 401 },
			);
		}
		const eventType = String(payload?.type || "");
		if (!SUPPORTED_TYPES.has(eventType)) {
			return json({ success: true, ignored: true, eventType });
		}
		const externalId =
			payload?.kofi_transaction_id ||
			payload?.message_id ||
			payload?.subscription_id;
		const isPrivate =
			payload?.is_public === false || payload?.is_public === "false";
		const batch = buildSupporterBatch(env.SAYORI_ANALYTICS_DB, {
			source: "Ko-fi",
			sourceKey: "kofi",
			externalId,
			eventType,
			displayName: isPrivate
				? "匿名支持者"
				: supporterDisplayName(payload?.from_name),
			amountMinor: parseExternalAmount(
				payload?.amount,
				payload?.currency,
			),
			currency: normalizeCurrency(payload?.currency),
			createdAt: Date.parse(String(payload?.timestamp || "")),
		});
		if (!batch) {
			return json(
				{ success: false, error: "missing Ko-fi transaction id" },
				{ status: 400 },
			);
		}
		const results = await env.SAYORI_ANALYTICS_DB.batch(batch.statements);
		return json({
			success: true,
			duplicate: !batchWasInserted(results?.[0]),
			supporterRecorded: batchWasInserted(results?.[1]),
		});
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json(
				{ success: false, error: "invalid Ko-fi payload" },
				{ status: 400 },
			);
		}
		console.error("[kofi-webhook]", error);
		return json(
			{ success: false, error: "Ko-fi webhook processing failed" },
			{ status: 500 },
		);
	}
}

export function onRequestGet() {
	return methodNotAllowed("POST, OPTIONS");
}

export function onRequestOptions() {
	return optionsResponse("POST, OPTIONS");
}

function timingSafeEqualText(left, right) {
	const a = String(left ?? "");
	const b = String(right ?? "");
	if (!a || a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index += 1) {
		difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return difference === 0;
}

export { SUPPORTED_TYPES };
