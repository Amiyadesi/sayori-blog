import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const blogRoot = path.resolve(path.dirname(scriptFile), "..");
const repoRoot = path.resolve(blogRoot, "..");
const postsRoot = path.join(repoRoot, "articles", "posts");

const args = process.argv.slice(2);
const flags = parseFlags(args);

if (!flags.target) {
	console.error(
		"Usage: pnpm track-post-edit -- <slug-or-md-path> [--date YYYY-MM-DD] [--set-count N]",
	);
	process.exit(1);
}

if (!isDate(flags.date)) {
	console.error(`Error: invalid --date value: ${flags.date}`);
	process.exit(1);
}

if (
	flags.setCount !== undefined &&
	(!Number.isInteger(flags.setCount) || flags.setCount < 0)
) {
	console.error(
		`Error: --set-count must be a non-negative integer: ${flags.setCount}`,
	);
	process.exit(1);
}

if (!fs.existsSync(postsRoot)) {
	console.error(`Error: articles posts dir not found: ${postsRoot}`);
	process.exit(1);
}

const targetPath = resolveTarget(flags.target);
if (!targetPath) {
	console.error(`Error: post not found: ${flags.target}`);
	process.exit(1);
}

const original = fs.readFileSync(targetPath, "utf8");
let next;
try {
	next = updatePostHistory(original, flags.date, flags.setCount);
} catch (error) {
	console.error(`Error: ${error.message}`);
	process.exit(1);
}

if (next === original) {
	console.log(`No change: ${path.relative(repoRoot, targetPath)}`);
	process.exit(0);
}

fs.writeFileSync(targetPath, next);

const history = readHistory(next);
console.log(`Updated: ${path.relative(repoRoot, targetPath)}`);
console.log(`created: ${history.created}`);
console.log(`updated: ${history.updated}`);
console.log(`lastEdited: ${history.lastEdited}`);
console.log(`updateCount: ${history.updateCount}`);

function parseFlags(values) {
	const result = {
		target: "",
		date: today(),
		setCount: undefined,
	};

	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		if (value === "--date") {
			result.date = values[++i] || "";
			continue;
		}
		if (value === "--set-count") {
			result.setCount = Number(values[++i]);
			continue;
		}
		if (!result.target) {
			result.target = value;
			continue;
		}
		console.error(`Error: unexpected argument: ${value}`);
		process.exit(1);
	}

	return result;
}

function today() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isDate(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveTarget(value) {
	const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
	const direct = path.resolve(repoRoot, value);
	const underPosts = path.join(postsRoot, normalized);

	for (const candidate of [direct, underPosts]) {
		if (!isInsidePostsRoot(candidate)) {
			continue;
		}
		const resolved = resolveExistingCandidate(candidate);
		if (resolved) {
			return resolved;
		}
	}

	const withoutExt = normalized.replace(/\.(md|mdx)$/i, "");
	const slugTarget = slugifyPath(withoutExt);

	for (const filePath of walk(postsRoot)) {
		if (!/\.(md|mdx)$/i.test(filePath)) {
			continue;
		}
		const relative = path
			.relative(postsRoot, filePath)
			.replaceAll("\\", "/");
		const slug = toPostSlug(relative);
		const baseName = path.basename(filePath).replace(/\.(md|mdx)$/i, "");
		if (
			slug === slugTarget ||
			slug === withoutExt ||
			baseName === withoutExt ||
			path.relative(repoRoot, filePath).replaceAll("\\", "/") ===
				normalized
		) {
			return filePath;
		}
	}

	return null;
}

function isInsidePostsRoot(candidate) {
	const relative = path.relative(postsRoot, path.resolve(candidate));
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

function resolveExistingCandidate(candidate) {
	if (fs.existsSync(candidate)) {
		const stats = fs.statSync(candidate);
		if (stats.isFile() && /\.(md|mdx)$/i.test(candidate)) {
			return candidate;
		}
		if (stats.isDirectory()) {
			return findMainMarkdown(candidate);
		}
	}

	if (!/\.(md|mdx)$/i.test(candidate)) {
		for (const ext of [".md", ".mdx"]) {
			if (fs.existsSync(`${candidate}${ext}`)) {
				return `${candidate}${ext}`;
			}
		}

		const folderName = path.basename(candidate);
		for (const ext of [".md", ".mdx"]) {
			const nested = path.join(candidate, `${folderName}${ext}`);
			if (fs.existsSync(nested)) {
				return nested;
			}
			const index = path.join(candidate, `index${ext}`);
			if (fs.existsSync(index)) {
				return index;
			}
		}
	}

	return null;
}

function findMainMarkdown(dirPath) {
	const entries = fs.readdirSync(dirPath);
	const dirName = path.basename(dirPath).toLowerCase();

	for (const entry of entries) {
		const baseName = entry.replace(/\.(md|mdx)$/i, "").toLowerCase();
		if (
			/\.(md|mdx)$/i.test(entry) &&
			(baseName === dirName || baseName === "index")
		) {
			return path.join(dirPath, entry);
		}
	}

	const markdownFiles = entries.filter((entry) => /\.(md|mdx)$/i.test(entry));
	return markdownFiles.length === 1
		? path.join(dirPath, markdownFiles[0])
		: null;
}

function updatePostHistory(content, date, setCount) {
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		throw new Error("frontmatter not found");
	}

	const frontmatter = match[1];
	const fields = parseFrontmatter(frontmatter);
	const updateCount =
		setCount ??
		(Number.isInteger(Number(fields.updateCount))
			? Number(fields.updateCount) + 1
			: 1);
	const updates = {
		created: fields.created || fields.published || date,
		updated: date,
		lastEdited: date,
		updateCount: String(updateCount),
	};

	const nextFrontmatter = applyFrontmatterUpdates(frontmatter, updates, eol);
	return content.replace(match[1], nextFrontmatter);
}

function parseFrontmatter(frontmatter) {
	const fields = {};
	for (const line of frontmatter.split(/\r?\n/)) {
		const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
		if (!match) {
			continue;
		}
		fields[match[1]] = unquote(match[2].trim());
	}
	return fields;
}

function unquote(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}

function applyFrontmatterUpdates(frontmatter, updates, eol) {
	const lines = frontmatter.split(/\r?\n/);
	const order = ["created", "updated", "lastEdited", "updateCount"];
	const present = new Set();

	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(/^(\s*)([A-Za-z][A-Za-z0-9_-]*)\s*:/);
		if (!match) {
			continue;
		}
		const [, indent, key] = match;
		if (key in updates) {
			lines[i] = `${indent}${key}: ${updates[key]}`;
			present.add(key);
		}
	}

	const missing = order.filter((key) => !present.has(key));
	if (!missing.length) {
		return lines.join(eol);
	}

	const publishedIndex = lines.findIndex((line) =>
		/^published\s*:/.test(line),
	);
	let insertAt = publishedIndex >= 0 ? publishedIndex + 1 : 0;
	for (const key of missing) {
		lines.splice(insertAt, 0, `${key}: ${updates[key]}`);
		insertAt++;
	}

	return lines.join(eol);
}

function readHistory(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? parseFrontmatter(match[1]) : {};
}

function* walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const current = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(current);
		} else {
			yield current;
		}
	}
}

function toPostSlug(relativePath) {
	const withoutExt = relativePath.replace(/\.(md|mdx)$/i, "");
	const segments = withoutExt.split("/");

	if (segments.at(-1)?.toLowerCase() === "index") {
		segments.pop();
	}

	if (segments.length >= 2) {
		const last = segments[segments.length - 1].toLowerCase();
		const parent = segments[segments.length - 2].toLowerCase();
		if (last === parent) {
			segments.pop();
		}
	}

	return slugifyPath(segments.join("/"));
}

function slugifyPath(value) {
	return value
		.split("/")
		.map((segment) =>
			segment
				.normalize("NFKD")
				.toLowerCase()
				.trim()
				.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.filter(Boolean)
		.join("/");
}
