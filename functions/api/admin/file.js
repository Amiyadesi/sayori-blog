import { handleError, json, requireAdmin } from "../../_lib/admin.js";

function writingDisabledResponse() {
	return json(
		{
			success: false,
			error: "网页后台写作已封印；请从 Obsidian 插件发布文章。",
		},
		{ status: 410 },
	);
}

export async function onRequestGet(context) {
	try {
		await requireAdmin(context.request, context.env);
		return writingDisabledResponse();
	} catch (error) {
		return handleError(error);
	}
}

export async function onRequestPut(context) {
	try {
		await requireAdmin(context.request, context.env);
		return writingDisabledResponse();
	} catch (error) {
		return handleError(error);
	}
}
