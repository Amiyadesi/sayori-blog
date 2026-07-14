import { handleError, json, requireAdmin } from "../../_lib/admin.js";
import {
	getAdminAnalytics,
	normalizeAnalyticsQuery,
} from "../../_lib/analytics.js";

export async function onRequestGet(context) {
	try {
		await requireAdmin(context.request, context.env);
		const url = new URL(context.request.url);
		const query = normalizeAnalyticsQuery(url);
		const data = await getAdminAnalytics(context.env, query);
		return json(data);
	} catch (error) {
		return handleError(error);
	}
}
