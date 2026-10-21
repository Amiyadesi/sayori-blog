const DAY = 86_400_000;
const PUBLIC_TAG = /(?:^|\s)#博客(?=\s|$)/u;

function eventBoundary(value) {
	if (typeof value?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
		const date = new Date(`${value.date}T00:00:00Z`);
		if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.date) return value.date;
	}
	if (typeof value?.dateTime === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value.dateTime)) {
		const timestamp = Date.parse(value.dateTime);
		if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
	}
	throw new Error("Invalid calendar event boundary");
}

export function publicCalendarEvent(event) {
	if (!event || typeof event !== "object") throw new Error("Invalid calendar event");
	if (event.status === "cancelled" || event.visibility === "private" || event.attendees?.some((person) => person.self && person.responseStatus === "declined")) return null;
	const summary = typeof event.summary === "string" ? event.summary.trim() : "";
	const description = typeof event.description === "string" ? event.description.replace(/<[^>]*>/g, " ").trim() : "";
	const course = description.startsWith("【上课提醒】");
	if (!course && !PUBLIC_TAG.test(summary)) return null;
	let title = summary.replace(/(?:^|\s)#博客(?=\s|$)/gu, " ").trim();
	const location = typeof event.location === "string" ? event.location.trim() : "";
	// Imported class titles repeat the room; only remove a suffix that still matches the actual location.
	const split = title.match(/^(.*)[｜|]([^｜|]+)$/u);
	const roomText = (text) => text.replace(/[\s\-–—]/gu, "");
	if (course && split && roomText(location).includes(roomText(split[2]))) title = split[1].trim();
	const start = eventBoundary(event.start);
	const end = eventBoundary(event.end);
	if (!title || title.length > 1000 || location.length > 2000 || (start.length === 10) !== (end.length === 10) || end <= start) throw new Error("Invalid calendar event");
	return { title, location, start, end, course };
}

export function calendarWindow(now = new Date()) {
	const date = new Date(now.getTime() + 8 * 3_600_000);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
	return {
		rangeStart: new Date(date.getTime() - 26 * 7 * DAY).toISOString().slice(0, 10),
		rangeEnd: new Date(date.getTime() + 27 * 7 * DAY).toISOString().slice(0, 10),
	};
}

export async function readCalendarEvents(calendarId, token, fetchImpl = fetch, now = new Date()) {
	if (typeof calendarId !== "string" || !calendarId.trim() || typeof token !== "string" || !token) throw new Error("Calendar credentials missing");
	const window = calendarWindow(now);
	const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId.trim())}/events`);
	url.search = new URLSearchParams({
		timeMin: `${window.rangeStart}T00:00:00+08:00`, timeMax: `${window.rangeEnd}T00:00:00+08:00`,
		singleEvents: "true", showDeleted: "false", orderBy: "startTime", maxResults: "2500", timeZone: "Asia/Shanghai",
		fields: "items(status,summary,description,location,start,end,visibility,attendees(self,responseStatus)),nextPageToken",
	}).toString();
	const events = [];
	let page = 0;
	do {
		const response = await fetchImpl(url.toString(), { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000) });
		if (!response.ok) throw new Error("Calendar source unavailable");
		const data = await response.json();
		if (!data || typeof data !== "object" || (data.items !== undefined && !Array.isArray(data.items)) || (data.nextPageToken !== undefined && typeof data.nextPageToken !== "string")) throw new Error("Invalid calendar response");
		for (const item of data.items || []) {
			const published = publicCalendarEvent(item);
			if (published) events.push(published);
		}
		if (!data.nextPageToken) break;
		if (++page >= 20) throw new Error("Calendar response too large");
		url.searchParams.set("pageToken", data.nextPageToken);
	} while (true);
	return { ...window, syncedAt: now.toISOString(), events };
}
