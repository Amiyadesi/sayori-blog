import { handleError, json, requireAdmin } from "../../_lib/admin.js";

export async function onRequestGet(context) {
	try {
		await requireAdmin(context.request, context.env);
		return json(
			{
				success: false,
				files: [],
				error: "网页后台写作已封印；内容源只从 articles/posts 和 Obsidian 插件维护。",
			},
			{ status: 410 },
		);
	} catch (error) {
		return handleError(error);
	}
}
