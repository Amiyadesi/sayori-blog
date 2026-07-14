import {
	corsHeadersForRequest,
	corsJson,
	handleAnalyticsError,
	recordAnalyticsEvent,
} from "../../_lib/analytics.js";

export async function onRequest(context) {
	if (context.request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: corsHeadersForRequest(context.request),
		});
	}
	if (context.request.method === "POST") {
		try {
			const result = await recordAnalyticsEvent(context);
			return corsJson(context.request, result);
		} catch (error) {
			return handleAnalyticsError(context.request, error);
		}
	}
	return corsJson(
		context.request,
		{ success: false, error: "method not allowed" },
		{ status: 405 },
	);
}
