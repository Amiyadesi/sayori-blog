import { handleError, redirect, requireAdmin } from "../_lib/admin.js";

export async function onRequest(context) {
	const headers = {
		"cache-control": "private, no-store",
		"x-robots-tag": "noindex, nofollow, noarchive",
	};
	try {
		await requireAdmin(context.request, context.env);
		const url = new URL(context.env.N8N_URL || context.env.PUBLIC_N8N_URL || "https://n8n.sayori.org/");
		if (url.protocol !== "https:" || url.username || url.password) {
			throw new Error("N8N_URL must be an HTTPS URL without embedded credentials");
		}
		return redirect(url.href, { headers });
	} catch (error) {
		if (error instanceof Response && error.status === 401) {
			return redirect("/admin/", { headers });
		}
		return handleError(error);
	}
}
