import { json } from "../../_lib/admin.js";
import {
	cleanDisplayName,
	methodNotAllowed,
	optionsResponse,
	stripeRequest,
} from "../../_lib/stripe.js";

const SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]+$/;

export async function onRequestGet({ request, env }) {
	try {
		if (!env.STRIPE_SECRET_KEY) {
			return json(
				{ success: false, error: "Stripe 支付暂未配置" },
				{ status: 503 },
			);
		}
		const sessionId = new URL(request.url).searchParams.get("session_id") || "";
		if (!SESSION_ID_PATTERN.test(sessionId)) {
			return json({ success: false, error: "invalid session_id" }, { status: 400 });
		}
		const session = await stripeRequest(
			env,
			`/checkout/sessions/${encodeURIComponent(sessionId)}`,
		);
		if (session?.metadata?.site !== "blog") {
			return json({ success: false, error: "session not found" }, { status: 404 });
		}
		const custom = Array.isArray(session.custom_fields)
			? session.custom_fields.find((field) => field?.key === "supporter_name")
			: null;
		return json({
			success: true,
			status: session.status || "",
			paymentStatus: session.payment_status || "",
			supporterName:
				cleanDisplayName(
					custom?.text?.value || session.metadata?.supporter_name || "",
				) || "",
		});
	} catch (error) {
		console.error("[stripe-session-status]", error);
		return json(
			{ success: false, error: "无法读取 Stripe 结账状态" },
			{ status: 502 },
		);
	}
}

export function onRequestPost() {
	return methodNotAllowed("GET, OPTIONS");
}

export function onRequestOptions() {
	return optionsResponse("GET, OPTIONS");
}
