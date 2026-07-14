import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const blogRoot = path.resolve(path.dirname(scriptFile), "..");
const repoRoot = path.resolve(blogRoot, "..");
const postsRoot = path.join(repoRoot, "articles", "posts");
const maxContentChars = Number(process.env.AI_SUMMARY_MAX_CHARS || 16000);

const args = parseArgs(process.argv.slice(2));

if (!fs.existsSync(postsRoot)) {
	console.error(`[ai-summary] posts dir not found: ${postsRoot}`);
	process.exit(1);
}

const dirtyPaths = collectDirtyPaths();
const candidates = collectCandidates()
	.filter((candidate) => !args.slug || candidate.slug === args.slug)
	.sort((a, b) => a.slug.localeCompare(b.slug));

if (args.slug && candidates.length === 0) {
	console.error(`[ai-summary] slug not found or not eligible: ${args.slug}`);
	process.exit(1);
}

const pending = [];
for (const candidate of candidates) {
	if (dirtyPaths.has(toRepoPath(candidate.filePath)) && !args.includeDirty) {
		console.log(`[ai-summary] skip dirty: ${candidate.repoPath}`);
		continue;
	}
	if (!args.force && hasAiSummary(candidate.content)) {
		continue;
	}
	pending.push(candidate);
}

if (args.dryRun) {
	console.log(`[ai-summary] eligible: ${candidates.length}`);
	console.log(`[ai-summary] pending: ${pending.length}`);
	for (const item of pending) {
		console.log(`  - ${item.slug} (${item.repoPath})`);
	}
	process.exit(0);
}

if (pending.length === 0) {
	console.log("[ai-summary] nothing to generate");
	process.exit(0);
}

const endpoint = normalizeEndpoint(process.env.AI_SUMMARY_BASE_URL);
const apiKey = process.env.AI_SUMMARY_API_KEY;
const model = process.env.AI_SUMMARY_MODEL || "gpt-5-mini";
if (!apiKey) {
	console.error("[ai-summary] missing AI_SUMMARY_API_KEY");
	process.exit(1);
}

for (const candidate of pending) {
	console.log(`[ai-summary] generate: ${candidate.slug}`);
	const items = await generateSummary({ endpoint, apiKey, model, candidate });
	const generatedAt = new Date().toISOString();
	const nextContent = upsertAiSummary(candidate.content, {
		generatedAt,
		model,
		sourceHash: candidate.sourceHash,
		items,
	});
	fs.writeFileSync(candidate.filePath, nextContent, "utf8");
}

console.log(`[ai-summary] generated: ${pending.length}`);

function parseArgs(values) {
	const result = {
		dryRun: false,
		force: false,
		includeDirty: false,
		slug: "",
	};
	for (let index = 0; index < values.length; index++) {
		const value = values[index];
		if (value === "--dry-run") result.dryRun = true;
		else if (value === "--force") result.force = true;
		else if (value === "--include-dirty") result.includeDirty = true;
		else if (value === "--all") continue;
		else if (value === "--slug") result.slug = values[++index] || "";
		else {
			console.error(`[ai-summary] unknown arg: ${value}`);
			process.exit(1);
		}
	}
	return result;
}

function normalizeEndpoint(baseUrl) {
	const base = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
	return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function collectDirtyPaths() {
	const result = spawnSync("git", ["-C", repoRoot, "status", "--porcelain", "-z"], {
		encoding: "utf8",
		windowsHide: true,
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.status !== 0) {
		return new Set();
	}
	const paths = new Set();
	const parts = result.stdout.split("\0").filter(Boolean);
	for (const part of parts) {
		const filePath = part.slice(3).trim();
		if (filePath) paths.add(filePath.replaceAll("\\", "/"));
	}
	return paths;
}

function collectCandidates() {
	const candidates = [];
	for (const filePath of walk(postsRoot)) {
		if (!/\.(md|mdx)$/i.test(filePath) || !isMainPostMarkdown(filePath)) {
			continue;
		}
		const repoPath = toRepoPath(filePath);
		const relative = path.relative(postsRoot, filePath).replaceAll("\\", "/");
		const slug = toPostSlug(relative);
		const content = fs.readFileSync(filePath, "utf8");
		const { frontmatter, body } = splitFrontmatter(content);
		if (!isEligible(relative, frontmatter)) {
			continue;
		}
		const normalizedBody = normalizeAiSummaryText(body);
		if (!normalizedBody) {
			continue;
		}
		candidates.push({
			filePath,
			repoPath,
			relative,
			slug,
			content,
			title: String(frontmatter.title || slug),
			description: String(frontmatter.description || ""),
			sourceHash: hashAiSummarySource(
				frontmatter.title || "",
				frontmatter.description || "",
				normalizedBody,
			),
			summaryContent:
				normalizedBody.length > maxContentChars
					? normalizedBody.slice(0, maxContentChars).trimEnd()
					: normalizedBody,
		});
	}
	return candidates;
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

function toRepoPath(filePath) {
	return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}

function isMainPostMarkdown(filePath) {
	const relative = path.relative(postsRoot, filePath).replaceAll("\\", "/");
	const parts = relative.split("/");
	const base = path.basename(parts.at(-1), path.extname(parts.at(-1))).toLowerCase();
	if (parts.length === 1) {
		return true;
	}
	const parent = parts.at(-2)?.toLowerCase();
	return base === "index" || base === parent;
}

function splitFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, body: content, rawFrontmatter: "" };
	}
	return {
		frontmatter: parseFrontmatterLines(match[1]),
		body: match[2],
		rawFrontmatter: match[1],
	};
}

function parseFrontmatterLines(raw) {
	const result = {};
	const lines = raw.split(/\r?\n/);
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const match = line.match(/^([^:\s][^:]*):\s*(.*?)\s*$/);
		if (!match) continue;
		const key = match[1].trim();
		const value = match[2].trim();
		if (!value) {
			const list = [];
			let cursor = index + 1;
			while (cursor < lines.length) {
				const listMatch = lines[cursor].match(/^\s*-\s+(.+?)\s*$/);
				if (!listMatch) break;
				list.push(parseFrontmatterValue(listMatch[1]));
				cursor++;
			}
			if (list.length) {
				result[key] = list;
				index = cursor - 1;
				continue;
			}
		}
		result[key] = parseFrontmatterValue(value);
	}
	return result;
}

function parseFrontmatterValue(value) {
	if (value === "true") return true;
	if (value === "false") return false;
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	if (value.startsWith("[") && value.endsWith("]")) {
		return value
			.slice(1, -1)
			.split(",")
			.map((item) => item.trim().replace(/^["']|["']$/g, ""))
			.filter(Boolean);
	}
	return value;
}

function isEligible(relativePath, frontmatter) {
	if (!frontmatter.title || frontmatter.draft === true) return false;
	if (frontmatter.encrypted === true || frontmatter.essay === true) return false;
	if (relativePath.startsWith("diary/")) return false;
	const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
	return !String(frontmatter.title).startsWith("日记：") && !tags.includes("日记");
}

function hasAiSummary(content) {
	const { rawFrontmatter } = splitFrontmatter(content);
	if (!rawFrontmatter) return false;
	const match = rawFrontmatter.match(/^aiSummary:\s*\r?\n([\s\S]*?)(?=^[^ \t\r\n][^:\r\n]*:|\s*$)/m);
	return Boolean(match && /^\s+items:\s*\r?\n\s+-\s+/m.test(match[1]));
}

function normalizeAiSummaryText(markdown) {
	return String(markdown || "")
		.replace(/^(```|~~~)[\s\S]*?^\1[ \t]*$/gm, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/!\[\[[^\]]+\]\]/g, " ")
		.replace(/!\[[^\]]*]\([^)]+\)/g, " ")
		.replace(/\[[^\]]+]\(([^)]+)\)/g, "$1")
		.replace(/[#>*_`~|[\](){}-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function hashAiSummarySource(title, description, body) {
	return crypto
		.createHash("sha256")
		.update([title, description, body].join("\n\n"))
		.digest("hex");
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
		if (last === parent) segments.pop();
	}
	return segments.map(slugify).join("/");
}

function slugify(value) {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

async function generateSummary({ endpoint, apiKey, model, candidate }) {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model,
			temperature: 0.2,
			max_tokens: 700,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: "Return strict JSON only.",
				},
				{
					role: "user",
					content: buildPrompt(candidate),
				},
			],
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`[ai-summary] provider failed ${response.status}: ${text.slice(0, 500)}`);
	}

	const data = await response.json();
	const content = data?.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("[ai-summary] provider returned empty content");
	}
	return parseItems(content);
}

function buildPrompt(candidate) {
	return [
		"你是博客文章摘要助手。只根据给定文章内容输出 JSON。",
		"要求：中文，3 到 5 条短要点；不编造原文没有的信息；不写免责声明；不输出 Markdown。",
		'JSON 格式必须是：{"items":["要点1","要点2"]}',
		"",
		`标题：${candidate.title}`,
		candidate.description ? `描述：${candidate.description}` : "",
		"正文：",
		candidate.summaryContent,
	]
		.filter(Boolean)
		.join("\n");
}

function parseItems(content) {
	const parsed = parseJsonPayload(content);
	const items = sanitizeItems(parsed.items);
	if (items.length < 3) {
		throw new Error("[ai-summary] provider returned too few items");
	}
	return items;
}

function parseJsonPayload(content) {
	const text = String(content)
		.replace(/^```(?:json)?/i, "")
		.replace(/```$/i, "")
		.trim();
	return JSON.parse(text);
}

function sanitizeItems(value) {
	if (!Array.isArray(value)) return [];
	const items = [];
	const seen = new Set();
	for (const raw of value) {
		const item = String(raw || "")
			.replace(/\s+/g, " ")
			.replace(/[。！？；]+$/u, "")
			.trim();
		if (!item || seen.has(item)) continue;
		seen.add(item);
		items.push(item.slice(0, 160));
		if (items.length >= 5) break;
	}
	return items;
}

function upsertAiSummary(content, summary) {
	const match = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/);
	if (!match) {
		throw new Error("[ai-summary] missing frontmatter block");
	}
	const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
	const lines = match[2].split(/\r?\n/);
	const nextLines = [];
	for (let index = 0; index < lines.length; index++) {
		if (/^aiSummary:\s*$/.test(lines[index])) {
			index++;
			while (index < lines.length && (/^\s/.test(lines[index]) || !lines[index].trim())) {
				index++;
			}
			index--;
			continue;
		}
		nextLines.push(lines[index]);
	}
	if (nextLines.at(-1)?.trim()) {
		nextLines.push("");
	}
	nextLines.push(...formatAiSummary(summary));
	return `${match[1]}${nextLines.join(lineEnding)}${match[3]}${match[4]}`;
}

function formatAiSummary(summary) {
	return [
		"aiSummary:",
		`  generatedAt: "${escapeYamlString(summary.generatedAt)}"`,
		`  model: "${escapeYamlString(summary.model)}"`,
		`  sourceHash: "${escapeYamlString(summary.sourceHash)}"`,
		"  items:",
		...summary.items.map((item) => `    - "${escapeYamlString(item)}"`),
	];
}

function escapeYamlString(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
