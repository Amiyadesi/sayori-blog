import { handleError, json, requireAdmin } from "../../../_lib/admin.js";
import {
	buildInitialActions,
	ensureGrowthSeeds,
	listGrowthOverview,
	opportunisticPrune,
	sourceConfiguration,
} from "../../../_lib/growth.js";

export async function onRequestGet(context) {
	try {
		const user = await requireAdmin(context.request, context.env);
		const db = context.env.SAYORI_ANALYTICS_DB;
		if (!db) {
			throw json({ success: false, error: "Cloudflare 缺少 SAYORI_ANALYTICS_DB" }, { status: 503 });
		}
		await ensureGrowthSeeds(db);
		await opportunisticPrune(db);
		const overview = await listGrowthOverview(db);
		return json({
			success: true,
			user,
			configuration: sourceConfiguration(context.env),
			actions: buildInitialActions(overview),
			...overview,
		});
	} catch (error) {
		return handleError(error);
	}
}
