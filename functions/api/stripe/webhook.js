import { json } from "../../_lib/admin.js";
import {
	extractSupporterName,
	methodNotAllowed,
	optionsResponse,
	verifyStripeSignature,
} from "../../_lib/stripe.js";

const EVENT_ID_PATTERN = /^evt_[A-Za-z0-9_]+$/;
const SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]+$/;
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9_]+$/;
const CHARGE_ID_PATTERN = /^ch_[A-Za-z0-9_]+$/;
const CHECKOUT_EVENTS = new Set([
	"checkout.session.completed",
	"checkout.session.async_payment_succeeded",
]);
const REFUND_EVENTS = new Set([
	"charge.refunded",
	"refund.created",
	"refund.updated",
]);
const DISPUTE_EVENTS = new Set([
	"charge.dispute.created",
	"charge.dispute.updated",
	"charge.dispute.closed",
	"charge.dispute.funds_reinstated",
	"charge.dispute.funds_withdrawn",
]);
const SUPPORTED_EVENTS = new Set([
	...CHECKOUT_EVENTS,
	...REFUND_EVENTS,
	...DISPUTE_EVENTS,
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
		const eventType = String(event.type || "unknown");
		const session = CHECKOUT_EVENTS.has(eventType) ? event.data?.object : null;
		const status = supporterStatusForEvent(eventType, event.data?.object);
		const statements = [
			env.SAYORI_ANALYTICS_DB
				.prepare(
					`INSERT OR IGNORE INTO stripe_webhook_events
						(id, event_type, created_at, processed_at)
					 VALUES (?, ?, ?, ?)`,
				)
				.bind(String(event.id), eventType, eventCreatedAt, now),
		];

		if (shouldRecordSupporter(eventType, session)) {
			const name = supporterName(session);
			statements.push(
				env.SAYORI_ANALYTICS_DB
					.prepare(
						`INSERT OR IGNORE INTO stripe_supporters
							(id, display_name, source, session_id, amount_minor, currency, created_at,
							 status, payment_intent_id, charge_id, status_updated_at)
						 VALUES (?, ?, 'Stripe', ?, ?, ?, ?, 'active', ?, ?, ?)`,
					)
					.bind(
						`stripe:${session.id}`,
						name,
						String(session.id),
						Number.isSafeInteger(session.amount_total) ? session.amount_total : 0,
						String(session.currency || "hkd").toLowerCase(),
						toMilliseconds(session.created, eventCreatedAt),
						stripeIdentifier(session.payment_intent, PAYMENT_INTENT_ID_PATTERN),
						stripeIdentifier(session.latest_charge, CHARGE_ID_PATTERN),
						eventCreatedAt,
					),
			);
		}

		const statusStatement = status
			? buildStatusUpdate(
					env.SAYORI_ANALYTICS_DB,
					status,
					event.data?.object,
					eventCreatedAt,
				)
			: null;
		if (statusStatement) statements.push(statusStatement);

		const results = await env.SAYORI_ANALYTICS_DB.batch(statements);
		const eventInserted = Number(results?.[0]?.meta?.changes || 0) > 0;
		const supporterInserted =
			Boolean(session) && Number(results?.[1]?.meta?.changes || 0) > 0;
		const response = {
			success: true,
			duplicate: !eventInserted,
			supporterRecorded: supporterInserted,
		};
		if (statusStatement) {
			const statusResultIndex = statements.indexOf(statusStatement);
			response.supporterStatusUpdated =
				Number(results?.[statusResultIndex]?.meta?.changes || 0) > 0;
		}
		return json(response);
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
	if (session.metadata?.site !== "blog") return false;
	if (eventType === "checkout.session.async_payment_succeeded") return true;
	return eventType === "checkout.session.completed" && session.payment_status === "paid";
}

function supporterStatusForEvent(eventType, object) {
	if (REFUND_EVENTS.has(eventType)) {
		if (eventType === "refund.updated") {
			const refundStatus = String(object?.status || "").toLowerCase();
			if (["failed", "canceled"].includes(refundStatus)) return "";
		}
		if (eventType === "charge.refunded") {
			const amount = Number(object?.amount);
			const amountRefunded = Number(object?.amount_refunded);
			if (Number.isFinite(amount) && amount > 0 && amountRefunded < amount) {
				return "partially_refunded";
			}
		}
		return "refunded";
	}

	if (DISPUTE_EVENTS.has(eventType)) {
		if (eventType === "charge.dispute.closed") {
			return String(object?.status || "").toLowerCase() === "won"
				? "dispute_won"
				: "dispute_lost";
		}
		if (eventType === "charge.dispute.funds_reinstated") return "dispute_won";
		return "disputed";
	}

	return "";
}

function stripeIdentifier(value, pattern) {
	const id = typeof value === "string" ? value : value?.id;
	return pattern.test(String(id || "")) ? String(id) : "";
}

function buildStatusUpdate(db, status, object, updatedAt) {
	const paymentIntentId = stripeIdentifier(
		object?.payment_intent,
		PAYMENT_INTENT_ID_PATTERN,
	);
	const chargeId =
		stripeIdentifier(object?.charge, CHARGE_ID_PATTERN) ||
		stripeIdentifier(object?.id, CHARGE_ID_PATTERN);
	const identifiers = [];
	const args = [];
	if (paymentIntentId) {
		identifiers.push("payment_intent_id = ?");
		args.push(paymentIntentId);
	}
	if (chargeId) {
		identifiers.push("charge_id = ?");
		args.push(chargeId);
	}
	if (identifiers.length === 0) return null;
	return db
		.prepare(
			`UPDATE stripe_supporters
			 SET status = ?, status_updated_at = ?, charge_id = COALESCE(?, charge_id)
			 WHERE source = 'Stripe' AND status <> ? AND (${identifiers.join(" OR ")})`,
		)
		.bind(status, updatedAt, chargeId || null, status, ...args);
}

function supporterName(session) {
	return extractSupporterName(session);
}

function toMilliseconds(value, fallback) {
	const seconds = Number(value);
	return Number.isSafeInteger(seconds) && seconds > 0 ? seconds * 1000 : fallback;
}

export {
	SUPPORTED_EVENTS,
	buildStatusUpdate,
	shouldRecordSupporter,
	stripeIdentifier,
	supporterName,
	supporterStatusForEvent,
	toMilliseconds,
};
