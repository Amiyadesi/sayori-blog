import { handleError, json, requireAdmin, requireSameOrigin } from "../../../_lib/admin.js";
import { deleteGrowthChannel, upsertGrowthChannel } from "../../../_lib/growth-store.js";

async function authorize(context) {
	await requireAdmin(context.request, context.env);
	requireSameOrigin(context.request);
	if (!context.env.SAYORI_ANALYTICS_DB) throw json({ success: false, error: "增长数据库未配置" }, { status: 503 });
}

export async function onRequestPost(context) {
	try {
		await authorize(context);
		const body = await context.request.json();
		let channel;
		try {
			channel = await upsertGrowthChannel(context.env.SAYORI_ANALYTICS_DB, body);
		} catch (error) {
			throw json({ success: false, error: error.message }, { status: 400 });
		}
		return json({ success: true, channel });
	} catch (error) {
		return handleError(error);
	}
}

export async function onRequestDelete(context) {
	try {
		await authorize(context);
		const body = await context.request.json();
		let result;
		try {
			result = await deleteGrowthChannel(context.env.SAYORI_ANALYTICS_DB, body.id);
		} catch (error) {
			throw json({ success: false, error: error.message }, { status: 400 });
		}
		return json({ success: true, ...result });
	} catch (error) {
		return handleError(error);
	}
}
