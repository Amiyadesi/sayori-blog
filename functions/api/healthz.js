const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestGet(context) {
	try {
		const row = await context.env.SAYORI_ANALYTICS_DB
			.prepare("SELECT 1 AS ok")
			.first();
		if (row?.ok !== 1) {
			throw new Error("D1 health query returned an unexpected result");
		}
		return json({ status: "ok" }, 200);
	} catch {
		return json({ status: "unavailable" }, 503);
	}
}

export function onRequestOptions() {
	return new Response(null, {
		status: 204,
		headers: CORS_HEADERS,
	});
}

function json(body, status) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			...CORS_HEADERS,
			"Cache-Control": "no-store",
			"Content-Type": "application/json; charset=utf-8",
		},
	});
}
