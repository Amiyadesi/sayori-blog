import { handleError, redirect, requireAdmin } from "../_lib/admin.js";

export async function onRequest(context) {
	try {
		await requireAdmin(context.request, context.env);
		const url = new URL(context.env.N8N_URL || context.env.PUBLIC_N8N_URL || "https://n8n.sayori.org/");
		if (url.protocol !== "https:" || url.username || url.password) {
			throw new Error("N8N_URL must be an HTTPS URL without embedded credentials");
		}
		return redirect(url.href, { headers: { "cache-control": "private, no-store" } });
	} catch (error) {
		if (error instanceof Response && error.status === 401) {
			return redirect("/admin/", { headers: { "cache-control": "private, no-store" } });
		}
		return handleError(error);
	}
}
