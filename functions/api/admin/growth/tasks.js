import { handleError, json, requireAdmin, requireSameOrigin } from "../../../_lib/admin.js";
import { updateGrowthTask } from "../../../_lib/growth-store.js";

export async function onRequestPost(context) {
	try {
		await requireAdmin(context.request, context.env);
		requireSameOrigin(context.request);
		if (!context.env.SAYORI_ANALYTICS_DB) throw json({ success: false, error: "增长数据库未配置" }, { status: 503 });
		const body = await context.request.json();
		let task;
		try {
			task = await updateGrowthTask(context.env.SAYORI_ANALYTICS_DB, body);
		} catch (error) {
			throw json({ success: false, error: error.message }, { status: 400 });
		}
		return json({ success: true, task });
	} catch (error) {
		return handleError(error);
	}
}
