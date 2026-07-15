/* Create a new source article under sayori-articles/posts/<slug>/<slug>.md. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const blogRoot = path.resolve(path.dirname(scriptFile), "..");
const repoRoot = path.resolve(blogRoot, "..");
const articlesRoot = resolveContentRoot();
const postsRoot = path.join(articlesRoot, "posts");

const args = process.argv.slice(2);

if (args.length === 0) {
	console.error(`Error: No slug argument provided
Usage: pnpm new-post <slug> [title]`);
	process.exit(1);
}

const rawSlug = stripMarkdownExtension(args[0]);
const slug = slugify(rawSlug);
const title = (args.slice(1).join(" ") || rawSlug).trim();
const today = getDate();

if (!slug) {
	console.error(`Error: Invalid slug "${args[0]}"`);
	process.exit(1);
}

const targetDir = path.join(postsRoot, slug);
const targetPath = path.join(targetDir, `${slug}.md`);

if (fs.existsSync(targetPath)) {
	console.error(
		`Error: File ${path.relative(articlesRoot, targetPath)} already exists`,
	);
	process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetPath, buildPostContent({ title, today }), "utf8");

console.log(`Post ${path.relative(articlesRoot, targetPath)} created`);

function resolveContentRoot() {
	const configured = String(process.env.CONTENT_DIR || "").trim();
	return configured
		? path.resolve(blogRoot, configured)
		: path.join(repoRoot, "sayori-articles");
}

function getDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function stripMarkdownExtension(value) {
	return (
		value
			.replace(/\.(md|mdx)$/i, "")
			.replaceAll("\\", "/")
			.split("/")
			.at(-1) ?? ""
	);
}

function slugify(value) {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

function escapeYamlString(value) {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function buildPostContent({ title, today }) {
	return `---
title: ${escapeYamlString(title)}
published: ${today}
created: ${today}
updated: ${today}
lastEdited: ${today}
updateCount: 0
description: ""
image: ""
tags: []
category: ""
draft: true
alias: ""
---

# ${title}
`;
}
