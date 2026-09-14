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

export async function onRequestPost({ request, env }) {
	try {
		if (!env.AFDIAN_WEBHOOK_TOKEN || !env.SAYORI_ANALYTICS_DB) {
			return afdianJson(
				{ success: false, error: "爱发电 webhook 暂未配置" },
				503,
			);
		}
		const url = new URL(request.url);
		const suppliedToken =
			url.searchParams.get("token") ||
			request.headers.get("x-afdian-webhook-token") ||
			"";
		if (!timingSafeEqualText(suppliedToken, env.AFDIAN_WEBHOOK_TOKEN)) {
			return afdianJson(
				{ success: false, error: "invalid Afdian webhook token" },
				401,
			);
		}
		const rawBody = await request.text();
		if (rawBody.length > MAX_BODY_LENGTH) {
			return afdianJson(
				{ success: false, error: "payload too large" },
				413,
			);
		}
		const payload = JSON.parse(rawBody);
		const order = payload?.data?.order;
		if (payload?.ec !== undefined && Number(payload.ec) !== 200) {
			return afdianJson({
				success: true,
				ignored: true,
				reason: "upstream error",
			});
		}
		if (!order || String(payload?.data?.type || "") !== "order") {
			return afdianJson({
				success: true,
				ignored: true,
				reason: "not an order",
			});
		}
		if (Number(order.status) !== 2) {
			return afdianJson({
				success: true,
				ignored: true,
				reason: "order not paid",
			});
		}
		const userId = String(order.user_id || "").trim();
		const batch = buildSupporterBatch(env.SAYORI_ANALYTICS_DB, {
			source: "爱发电",
			sourceKey: "afdian",
			externalId: order.out_trade_no,
			eventType: "order",
			displayName: supporterDisplayName(
				order.user_name ||
					order.user?.name ||
					payload?.data?.user?.name ||
					(userId ? `爱发电用户_${userId.slice(-8)}` : ""),
			),
			amountMinor: parseExternalAmount(
				order.show_amount || order.total_amount,
				"cny",
			),
			currency: normalizeCurrency("cny"),
			createdAt:
				Number(order.create_time) > 0
					? Number(order.create_time) * 1000
					: Date.now(),
		});
		if (!batch) {
			return afdianJson(
				{ success: false, error: "missing Afdian order id" },
				400,
			);
		}
		const results = await env.SAYORI_ANALYTICS_DB.batch(batch.statements);
		return afdianJson({
			success: true,
			duplicate: !batchWasInserted(results?.[0]),
			supporterRecorded: batchWasInserted(results?.[1]),
		});
	} catch (error) {
		if (error instanceof SyntaxError) {
			return afdianJson(
				{ success: false, error: "invalid Afdian payload" },
				400,
			);
		}
		console.error("[afdian-webhook]", error);
		return afdianJson(
			{ success: false, error: "Afdian webhook processing failed" },
			500,
		);
	}
}

export function onRequestGet() {
	return methodNotAllowed("POST, OPTIONS");
}

export function onRequestOptions() {
	return optionsResponse("POST, OPTIONS");
}

function afdianJson(data, status = 200) {
	return json(
		{
			ec: status === 200 ? 200 : status,
			em: status === 200 ? "ok" : "error",
			...data,
		},
		{ status },
	);
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
