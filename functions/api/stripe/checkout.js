import { assertSameOriginPost } from "../../_lib/post-interactions.js";
import { json } from "../../_lib/admin.js";
import {
	checkoutSessionForm,
	cleanDisplayName,
	DEFAULT_DONATION_CURRENCY,
	getDonationCurrency,
	methodNotAllowed,
	optionsResponse,
	parseDonationAmount,
	stripeRequest,
} from "../../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
	try {
		assertSameOriginPost(request);
		if (!env.STRIPE_SECRET_KEY) {
			return json(
				{ success: false, error: "Stripe 支付暂未配置" },
				{ status: 503 },
			);
		}
		const payload = await request.json().catch(() => null);
		if (payload?.confirmed !== true) {
			return json(
				{ success: false, error: "请先确认支持说明" },
				{ status: 400 },
			);
		}
		const currencyCode = String(
			payload?.currency ?? DEFAULT_DONATION_CURRENCY,
		)
			.trim()
			.toLowerCase();
		const currency = getDonationCurrency(currencyCode);
		if (!currency) {
			return json(
				{ success: false, error: "暂不支持该币种" },
				{ status: 400 },
			);
		}
		const amountMinor = parseDonationAmount(payload?.amount, currency.code);
		if (!amountMinor) {
			return json(
				{
					success: false,
					error: `金额需为 ${currency.minimum}–${currency.maximum} ${currency.code.toUpperCase()}`,
				},
				{ status: 400 },
			);
		}
		const displayName = cleanDisplayName(payload?.name);
		const url = new URL(request.url);
		const session = await stripeRequest(env, "/checkout/sessions", {
			method: "POST",
			form: checkoutSessionForm({
				amountMinor,
				currency: currency.code,
				displayName,
				origin: url.origin,
				pathname: url.pathname,
			}),
		});
		if (!session?.url) {
			return json(
				{ success: false, error: "Stripe 未返回结账地址" },
				{ status: 502 },
			);
		}
		return json({ success: true, url: session.url });
	} catch (error) {
		if (error instanceof Response) return error;
		console.error("[stripe-checkout]", error);
		return json(
			{ success: false, error: "暂时无法创建 Stripe 结账会话" },
			{ status: 502 },
		);
	}
}

export function onRequestGet() {
	return methodNotAllowed("POST, OPTIONS");
}

export function onRequestOptions() {
	return optionsResponse("POST, OPTIONS");
}
