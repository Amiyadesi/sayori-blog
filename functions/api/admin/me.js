import { getPublicEnv, json, requireAdmin, handleError } from "../../_lib/admin.js";

export async function onRequestGet(context) {
	try {
		const user = await requireAdmin(context.request, context.env);
		return json({
			success: true,
			user,
			config: getPublicEnv(context.env),
		});
	} catch (error) {
		return handleError(error);
	}
}
