import { handleError, json, requireAdmin } from "../../../_lib/admin.js";

export async function onRequestGet(context) {
	try {
		await requireAdmin(context.request, context.env);
		return json(
			{
				success: false,
				applications: [],
				error: "网站后台操作已封印；友链请从本地内容源维护后部署。",
			},
			{ status: 410 },
		);
	} catch (error) {
		return handleError(error);
	}
}
