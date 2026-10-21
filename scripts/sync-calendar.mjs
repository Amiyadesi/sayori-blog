import { pathToFileURL } from "node:url";
import { readCalendarEvents } from "../functions/_lib/timetable-calendar.js";

const DATABASE_ID = "61babd32-ae72-4896-927d-8c246ed78292";

export async function syncCalendar(env, fetchImpl = fetch, now = new Date()) {
	for (const key of ["GOOGLE_CALENDAR_ID", "GOOGLE_ACCESS_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) {
		if (!env[key]?.trim()) throw new Error(`Missing ${key}`);
	}
	if (!/^[a-f\d]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)) throw new Error("Invalid Cloudflare account ID");
	const snapshot = await readCalendarEvents(env.GOOGLE_CALENDAR_ID, env.GOOGLE_ACCESS_TOKEN, fetchImpl, now);
	const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
		method: "POST",
		headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
		body: JSON.stringify({
			sql: "INSERT INTO timetable_calendar (id, body, synced_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body, synced_at = excluded.synced_at WHERE excluded.synced_at > timetable_calendar.synced_at",
			params: [JSON.stringify(snapshot), snapshot.syncedAt],
		}),
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok) throw new Error(`Calendar storage unavailable (${response.status})`);
	const result = await response.json();
	if (result.success !== true || !Array.isArray(result.result) || result.result.length !== 1 || result.result[0].success !== true) throw new Error("Calendar storage write failed");
	return { count: snapshot.events.length, syncedAt: snapshot.syncedAt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const result = await syncCalendar(process.env);
		console.log(`Calendar synced: ${result.count} public events at ${result.syncedAt}`);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
