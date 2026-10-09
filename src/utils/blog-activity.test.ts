import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
	activityDate,
	buildActivityCalendar,
	readSiteUpdateDates,
} from "./blog-activity";

test("activity uses Taipei dates and counts one article per day, including same-day publication edits", () => {
	assert.equal(activityDate(new Date("2026-10-08T17:00:00Z")), "2026-10-09");
	const days = buildActivityCalendar(
		[
			{
				published: new Date("2026-10-08"),
				edited: new Date("2026-10-09"),
			},
			{
				published: new Date("2026-10-09"),
				edited: new Date("2026-10-09"),
			},
		],
		["2026-10-09", "2026-10-09", "2026-10-10"],
		"2026-10-09",
	);
	const today = days.find((day) => day.date === "2026-10-09")!;
	assert.deepEqual([today.published, today.edited, today.site], [1, 1, 2]);
	assert.equal(days.filter((day) => day.inRange).length, 365);
	assert.equal(
		days
			.filter((day) => !day.inRange)
			.every((day) => day.published + day.edited + day.site === 0),
		true,
	);
	const leapYear = buildActivityCalendar([], [], "2024-03-01");
	assert.equal(leapYear.filter((day) => day.inRange).length, 365);
	assert.ok(leapYear.find((day) => day.date === "2024-02-29")?.inRange);
});

test("Git activity counts frontend commits once, ignores deployment-only commits and rejects incomplete history", (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-activity-"));
	t.after(() => {
		assert.ok(
			path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep),
		);
		fs.rmSync(root, { recursive: true, force: true });
	});
	const git = (...args: string[]) =>
		execFileSync("git", args, { cwd: root, stdio: "pipe" });
	git("init", "-b", "main");
	git("config", "user.name", "Activity Test");
	git("config", "user.email", "activity@example.invalid");
	const commit = (message: string, date: string) => {
		git("add", ".");
		execFileSync("git", ["commit", "-m", message], {
			cwd: root,
			stdio: "pipe",
			env: {
				...process.env,
				GIT_AUTHOR_DATE: date,
				GIT_COMMITTER_DATE: date,
			},
		});
	};
	fs.mkdirSync(path.join(root, "src/styles"), { recursive: true });
	fs.writeFileSync(path.join(root, "src/styles/main.css"), "body {}\n");
	commit("First style", "2026-10-08T17:00:00Z");
	fs.writeFileSync(path.join(root, "README.md"), "Deploy notes\n");
	commit("Deployment notes", "2026-10-09T02:00:00Z");
	fs.writeFileSync(
		path.join(root, "src/styles/main.css"),
		"body { color: olive; }\n",
	);
	fs.writeFileSync(path.join(root, "src/styles/reading.css"), "article {}\n");
	commit("Two files, one style update", "2026-10-09T03:00:00Z");
	assert.deepEqual(readSiteUpdateDates(root), ["2026-10-09", "2026-10-09"]);
	const shallow = path.join(root, "shallow");
	execFileSync(
		"git",
		["clone", "--depth", "1", pathToFileURL(root).href, shallow],
		{ stdio: "pipe" },
	);
	assert.throws(() => readSiteUpdateDates(shallow), /full Git history/);
});
