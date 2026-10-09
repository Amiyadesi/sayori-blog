import { execFileSync } from "node:child_process";

const DAY = 86_400_000;
const taipeiDate = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Taipei",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function activityDate(date: Date): string {
	const parts = taipeiDate.formatToParts(date);
	return ["year", "month", "day"]
		.map((type) => parts.find((part) => part.type === type)!.value)
		.join("-");
}

export function readSiteUpdateDates(cwd: string): string[] {
	const git = (args: string[]) =>
		execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
	if (git(["rev-parse", "--is-shallow-repository"]) !== "false") {
		throw new Error(
			"Blog activity requires full Git history; set checkout fetch-depth: 0.",
		);
	}
	const output = git([
		"log",
		"--first-parent",
		"--reverse",
		"--format=%ct",
		"--",
		"src/styles",
		"src/layouts",
		"src/pages",
		"src/components",
		"src/config.ts",
	]);
	if (!output) return [];
	return output.split(/\r?\n/).map((timestamp) => {
		if (!/^\d+$/.test(timestamp))
			throw new Error("Invalid Git activity timestamp");
		return activityDate(new Date(Number(timestamp) * 1000));
	});
}

export interface ActivityPost {
	published: Date;
	edited: Date;
}

export interface ActivityDay {
	date: string;
	inRange: boolean;
	published: number;
	edited: number;
	site: number;
}

export function buildActivityCalendar(
	posts: ActivityPost[],
	siteDates: string[],
	end: string,
): ActivityDay[] {
	const endTime = Date.parse(`${end}T00:00:00Z`);
	const startTime = endTime - 364 * DAY;
	const gridStart = startTime - new Date(startTime).getUTCDay() * DAY;
	const length = Math.ceil((endTime - gridStart + DAY) / (7 * DAY)) * 7;
	const days = Array.from({ length }, (_, index) => {
		const time = gridStart + index * DAY;
		return {
			date: new Date(time).toISOString().slice(0, 10),
			inRange: time >= startTime && time <= endTime,
			published: 0,
			edited: 0,
			site: 0,
		};
	});
	const byDate = new Map(
		days.filter((day) => day.inRange).map((day) => [day.date, day]),
	);
	for (const post of posts) {
		const published = activityDate(post.published);
		const edited = activityDate(post.edited);
		const day = byDate.get(published);
		if (day) day.published++;
		// shortcut: Only the latest edit date is recorded; dated history is needed to show every earlier edit.
		if (edited > published) {
			const editedDay = byDate.get(edited);
			if (editedDay) editedDay.edited++;
		}
	}
	for (const date of siteDates) {
		const day = byDate.get(date);
		if (day) day.site++;
	}
	return days;
}
