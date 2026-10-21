import OpenCC from "opencc-js";

const toTraditional = OpenCC.Converter({ from: "cn", to: "t" });
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" };

export async function onRequestGet(context) {
	const locale = new URL(context.request.url).searchParams.get("locale") || "zh-CN";
	if (!["zh-CN", "zh-Hant", "en"].includes(locale)) return Response.json({ error: "Invalid locale" }, { status: 400, headers });
	try {
		const row = await context.env.SAYORI_ANALYTICS_DB.prepare("SELECT body FROM timetable_calendar WHERE id = 1").first();
		if (!row) return Response.json({ error: "Calendar is not synced yet" }, { status: 503, headers });
		const data = JSON.parse(row.body);
		// Only the public snapshot fields can leave D1, even if its schema grows later.
		return Response.json({
			rangeStart: data.rangeStart, rangeEnd: data.rangeEnd, syncedAt: data.syncedAt,
			events: data.events.map(({ title, location, start, end, course }) => ({
				title: locale === "zh-Hant" ? toTraditional(title) : title,
				location: locale === "zh-Hant" ? toTraditional(location) : location,
				start, end, course,
			})),
		}, { headers });
	} catch {
		return Response.json({ error: "Calendar sync unavailable" }, { status: 503, headers });
	}
}
