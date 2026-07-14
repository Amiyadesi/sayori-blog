import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
	new URL("./track-post-edit.js", import.meta.url),
);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "blog-track-post-edit-"));

try {
	const fixtureRoot = path.join(tmpRoot, "remote_server");
	const fixtureBlog = path.join(fixtureRoot, "blog");
	const fixtureArticles = path.join(fixtureRoot, "articles");
	const fixtureScript = path.join(
		fixtureBlog,
		"scripts",
		"track-post-edit.js",
	);
	const postPath = path.join(fixtureArticles, "posts", "hello", "hello.md");

	fs.mkdirSync(path.dirname(fixtureScript), { recursive: true });
	fs.cpSync(scriptPath, fixtureScript);

	write(
		postPath,
		[
			"---",
			"title: Hello",
			"published: 2026-05-29",
			"description: Test",
			"---",
			"",
			"hello",
		].join("\n"),
	);

	const first = run(fixtureScript, "hello", "--date", "2026-06-09");
	assert.equal(first.status, 0, first.stderr || first.stdout);
	assert.match(read(postPath), /created: 2026-05-29/);
	assert.match(read(postPath), /updated: 2026-06-09/);
	assert.match(read(postPath), /lastEdited: 2026-06-09/);
	assert.match(read(postPath), /updateCount: 1/);

	const second = run(fixtureScript, "hello", "--date", "2026-06-10");
	assert.equal(second.status, 0, second.stderr || second.stdout);
	assert.match(read(postPath), /created: 2026-05-29/);
	assert.match(read(postPath), /updated: 2026-06-10/);
	assert.match(read(postPath), /lastEdited: 2026-06-10/);
	assert.match(read(postPath), /updateCount: 2/);

	const outside = run(fixtureScript, path.join(fixtureBlog, "package.json"));
	assert.equal(outside.status, 1);
	assert.match(outside.stderr, /post not found/);
} finally {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function run(scriptPath, ...args) {
	return spawnSync(process.execPath, [scriptPath, ...args], {
		encoding: "utf8",
	});
}

function write(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content);
}

function read(filePath) {
	return fs.readFileSync(filePath, "utf8");
}
