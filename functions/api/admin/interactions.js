import { handleError, json, requireAdmin } from "../../_lib/admin.js";
import {
	getAdminPostInteractions,
	normalizeAdminInteractionQuery,
} from "../../_lib/post-interactions.js";

export async function onRequestGet(context) {
	try {
		await requireAdmin(context.request, context.env);
		const query = normalizeAdminInteractionQuery(
			new URL(context.request.url),
		);
		const data = await getAdminPostInteractions(context.env, query);
		return json(data);
	} catch (error) {
		return handleError(error);
	}
}
