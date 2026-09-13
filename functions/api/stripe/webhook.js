import { json } from "../../_lib/admin.js";
import {
	cleanDisplayName,
	methodNotAllowed,
	optionsResponse,
	verifyStripeSignature,
} from "../../_lib/stripe.js";

const EVENT_ID_PATTERN = /^evt_[A-Za-z0-9_]+$/;
const SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]+$/;
const SUPPORTED_EVENTS = new Set([
	"checkout.session.completed",
	"checkout.session.async_payment_succeeded",
]);

export async function onRequestPost({ request, env }) {
	try {
		if (!env.STRIPE_WEBHOOK_SECRET || !env.SAYORI_ANALYTICS_DB) {
			return json(
				{ success: false, error: "Stripe webhook 暂未配置" },
				{ status: 503 },
			);
		}
		const rawBody = await request.text();
		if (rawBody.length > 1_000_000) {
			return json({ success: false, error: "payload too large" }, { status: 413 });
		}
		const signature = request.headers.get("stripe-signature");
		if (!(await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET))) {
			return json({ success: false, error: "invalid signature" }, { status: 400 });
		}
		const event = JSON.parse(rawBody);
		if (!EVENT_ID_PATTERN.test(String(event?.id || ""))) {
			return json({ success: false, error: "invalid event" }, { status: 400 });
		}

		const now = Date.now();
		const eventCreatedAt = toMilliseconds(event.created, now);
		const session = SUPPORTED_EVENTS.has(event.type) ? event.data?.object : null;
		const statements = [
			env.SAYORI_ANALYTICS_DB
				.prepare(
					`INSERT OR IGNORE INTO stripe_webhook_events
						(id, event_type, created_at, processed_at)
					 VALUES (?, ?, ?, ?)`,
				)
				.bind(String(event.id), String(event.type || "unknown"), eventCreatedAt, now),
		];

		if (shouldRecordSupporter(event.type, session)) {
			const name = supporterName(session);
			statements.push(
				env.SAYORI_ANALYTICS_DB
					.prepare(
						`INSERT OR IGNORE INTO stripe_supporters
							(id, display_name, source, session_id, amount_minor, currency, created_at)
						 VALUES (?, ?, 'Stripe', ?, ?, ?, ?)`,
					)
					.bind(
						`stripe:${session.id}`,
						name,
						String(session.id),
						Number.isSafeInteger(session.amount_total) ? session.amount_total : 0,
						String(session.currency || "hkd").toLowerCase(),
						toMilliseconds(session.created, eventCreatedAt),
					),
			);
		}

		const results = await env.SAYORI_ANALYTICS_DB.batch(statements);
		const eventInserted = Number(results?.[0]?.meta?.changes || 0) > 0;
		const supporterInserted = Number(results?.[1]?.meta?.changes || 0) > 0;
		return json({
			success: true,
			duplicate: !eventInserted,
			supporterRecorded: supporterInserted,
		});
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ success: false, error: "invalid payload" }, { status: 400 });
		}
		console.error("[stripe-webhook]", error);
		return json(
			{ success: false, error: "webhook processing failed" },
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

function shouldRecordSupporter(eventType, session) {
	if (!session || !SESSION_ID_PATTERN.test(String(session.id || ""))) return false;
	if (eventType === "checkout.session.async_payment_succeeded") return true;
	return eventType === "checkout.session.completed" && session.payment_status === "paid";
}

function supporterName(session) {
	const custom = Array.isArray(session.custom_fields)
		? session.custom_fields.find((field) => field?.key === "supporter_name")
		: null;
	return (
		cleanDisplayName(
			custom?.text?.value ||
				session.metadata?.supporter_name ||
				"匿名支持者",
		) || "匿名支持者"
	);
}

function toMilliseconds(value, fallback) {
	const seconds = Number(value);
	return Number.isSafeInteger(seconds) && seconds > 0 ? seconds * 1000 : fallback;
}

export { shouldRecordSupporter, supporterName, toMilliseconds };
