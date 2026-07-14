import { clearCookie, json, SESSION_COOKIE, requireSameOrigin, handleError } from "../../_lib/admin.js";

export async function onRequestPost(context) {
	try {
		requireSameOrigin(context.request);
		return json(
			{ success: true },
			{ headers: { "set-cookie": clearCookie(SESSION_COOKIE) } },
		);
	} catch (error) {
		return handleError(error);
	}
}
