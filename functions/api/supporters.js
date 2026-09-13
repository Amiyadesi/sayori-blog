import { json } from "../_lib/admin.js";
import { methodNotAllowed, optionsResponse } from "../_lib/stripe.js";

export async function onRequestGet({ env }) {
	try {
		if (!env.SAYORI_ANALYTICS_DB) {
			return json(
				{ success: false, error: "supporter list unavailable" },
				{ status: 503 },
			);
		}
		const rows = await env.SAYORI_ANALYTICS_DB
			.prepare(
				`SELECT display_name AS name, source, created_at AS createdAt
					 FROM stripe_supporters
					 WHERE status = 'active'
					 ORDER BY created_at DESC, id DESC
				 LIMIT 100`,
			)
			.all();
		return json({
			success: true,
			supporters: (rows.results || []).map((row) => ({
				name: String(row.name || ""),
				source: String(row.source || ""),
				createdAt: Number(row.createdAt || 0),
			})),
		});
	} catch (error) {
		console.error("[supporters]", error);
		return json(
			{ success: false, error: "supporter list unavailable" },
			{ status: 503 },
		);
	}
}

export function onRequestPost() {
	return methodNotAllowed("GET, OPTIONS");
}

export function onRequestOptions() {
	return optionsResponse("GET, OPTIONS");
}
