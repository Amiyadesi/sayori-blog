import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const blogRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articlesRoot = path.resolve(
	blogRoot,
	String(process.env.CONTENT_DIR || "../sayori-articles"),
);
const gemini = process.platform === "win32"
	? path.join(process.env.APPDATA || "", "npm", "node_modules", "@google", "gemini-cli", "bundle", "gemini.js")
	: "gemini";
const concurrency = Math.max(1, Number(process.env.TRANSLATE_CONCURRENCY || 2));
const model = String(process.env.TRANSLATE_MODEL || "gemini-2.5-pro");
const localEnv = loadDotEnv(
	path.join(process.env.USERPROFILE || process.env.HOME || "", ".gemini", ".env"),
);
const apiKey = String(process.env.TRANSLATE_API_KEY || localEnv.GEMINI_API_KEY || "").trim();
const apiEndpoint = normalizeEndpoint(
	process.env.TRANSLATE_BASE_URL || localEnv.GOOGLE_GEMINI_BASE_URL || "",
);
const timeoutMs = Math.max(30_000, Number(process.env.TRANSLATE_TIMEOUT_MS || 180_000));
const segmentThreshold = Math.max(4_000, Number(process.env.TRANSLATE_SEGMENT_THRESHOLD || 7_000));
const segmentChars = Math.max(1_500, Number(process.env.TRANSLATE_SEGMENT_CHARS || 4_500));
const includeReadmes = process.env.TRANSLATE_READMES === "1";
const allowStructureDrift = process.env.TRANSLATE_ALLOW_STRUCTURE_DRIFT === "1";
const force = process.env.TRANSLATE_FORCE === "1";
const matches = String(process.env.TRANSLATE_MATCH || "")
	.split(",")
	.map((value) => value.trim().replaceAll("\\", "/"))
	.filter(Boolean);

const roots = ["posts", "essays", "friends", "anime", "spec", "site"];
const allFiles = roots
	.flatMap((root) => [...walk(path.join(articlesRoot, root))])
	.filter((file) => /\.(md|mdx)$/i.test(file))
	.filter((file) => !/\.en\.(md|mdx)$/i.test(file))
	.filter((file) => includeReadmes || !/(^|[\\/])(README|templates)([\\/]|\.)/i.test(file))
	.filter((file) => !matches.length || matches.some((match) => relative(file).includes(match)));
const limit = Number(process.env.TRANSLATE_LIMIT || 0);
const files = limit > 0 ? allFiles.slice(0, limit) : allFiles;

const failures = [];
let nextIndex = 0;

console.log(`[translate-content] ${files.length} source files, concurrency ${concurrency}`);

async function worker() {
	while (true) {
		const index = nextIndex++;
		if (index >= files.length) return;
		const sourcePath = files[index];
		const targetPath = sourcePath.replace(/\.(md|mdx)$/i, ".en.$1");
		if (!force && fs.existsSync(targetPath)) {
			console.log(`[translate-content] skip existing ${relative(targetPath)}`);
			continue;
		}

		try {
			const source = fs.readFileSync(sourcePath, "utf8");
			const translated = await translate(source, relative(sourcePath));
			const normalized = normalizeEnglishMetadata(source, translated, relative(sourcePath));
			try {
				validateTranslation(source, normalized, sourcePath);
			} catch (error) {
				if (!allowStructureDrift) throw error;
				console.warn(`[translate-content] structure warning ${relative(sourcePath)}: ${error.message}`);
			}
			fs.writeFileSync(targetPath, normalized.endsWith("\n") ? normalized : `${normalized}\n`);
			console.log(`[translate-content] wrote ${relative(targetPath)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`${relative(sourcePath)}: ${message}`);
			console.error(`[translate-content] failed ${relative(sourcePath)}: ${message}`);
		}
	}
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length) {
	console.error(`\n[translate-content] ${failures.length} failed:`);
	for (const failure of failures) console.error(`- ${failure}`);
	process.exitCode = 1;
} else {
	console.log("[translate-content] all translations passed structural checks");
}

async function translate(source, sourceName) {
	if (source.length >= segmentThreshold) {
		return translateSegmented(source, sourceName);
	}
	return translateWhole(source, sourceName);
}

async function translateWhole(source, sourceName) {
	if (apiKey && apiEndpoint) {
		return translateViaApi(source, sourceName);
	}
	return translateViaCli(source, sourceName);
}

async function translateSegmented(source, sourceName) {
	const frontmatter = getFrontmatter(source);
	const body = frontmatter?.body ?? source;
	const translatedFrontmatter = frontmatter
		? await translateFrontmatter(frontmatter.raw, sourceName)
		: "";
	const protectedBody = protectSource(body, { protectGaps: true });
	const chunks = splitProtectedMarkdown(protectedBody.text, segmentChars);
	const translatedChunks = [];

	for (let index = 0; index < chunks.length; index++) {
		const chunk = chunks[index];
		translatedChunks.push(await translateSegmentChunk(chunk, `${sourceName} section ${index + 1}/${chunks.length}`, index + 1));
	}

	const translatedBody = restoreProtected(translatedChunks.join(""), protectedBody.values);
	if (!translatedBody.trim()) throw new Error("segmented translation returned empty body");
	if (!frontmatter) return translatedBody;
	return `---\n${translatedFrontmatter}\n---\n${translatedBody}`;
}

async function translateSegmentChunk(chunk, sourceName, sectionNumber) {
	const tokens = extractPreserveTokens(chunk);
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const translated = await translateWhole(chunk, sourceName);
			const missing = tokens.find((token) => !translated.includes(token));
			if (missing) throw new Error(`protected token lost in section ${sectionNumber}: ${missing}`);
			if (looksUntranslated(chunk, translated)) throw new Error(`section ${sectionNumber} was returned mostly untranslated`);
			return translated;
		} catch (error) {
			lastError = error;
			if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
		}
	}
	throw lastError;
}

function looksUntranslated(source, translated) {
	const sourceCjk = (String(source).match(/[\u3400-\u9fff]/g) || []).length;
	const translatedCjk = (String(translated).match(/[\u3400-\u9fff]/g) || []).length;
	if (sourceCjk < 20) return false;
	const sourceLatin = (String(source).match(/[A-Za-z]/g) || []).length;
	const translatedLatin = (String(translated).match(/[A-Za-z]/g) || []).length;
	return translatedCjk >= sourceCjk * 0.9 && translatedLatin < Math.max(20, sourceLatin * 0.5);
}

async function translateFrontmatter(raw, sourceName) {
	const translated = await translate(`---\n${raw}\n---`, `${sourceName} frontmatter`);
	const parsed = getFrontmatter(translated);
	if (!parsed) throw new Error("segmented frontmatter translation lost delimiters");
	return parsed.raw;
}

function splitProtectedMarkdown(text, maxChars) {
	const gapPattern = /(__PRESERVE_GAP_\d+__)/g;
	const pieces = String(text).split(gapPattern);
	const chunks = [];
	let current = "";
	for (const piece of pieces) {
		if (!piece) continue;
		if (piece.length > maxChars && !/^__PRESERVE_GAP_\d+__$/.test(piece)) {
			const lines = piece.match(/[^\n]*\n?|\n/g) || [piece];
			for (const line of lines) {
				if (current && current.length + line.length > maxChars) {
					chunks.push(current);
					current = "";
				}
				current += line;
			}
			continue;
		}
		if (current && current.length + piece.length > maxChars) {
			chunks.push(current);
			current = "";
		}
		current += piece;
	}
	if (current) chunks.push(current);
	return chunks.length ? chunks : [String(text)];
}

function extractPreserveTokens(text) {
	return [...String(text).matchAll(/__PRESERVE_[A-Z]+_\d+(?:_\d+)?__/g)].map((match) => match[0]);
}

async function translateViaApi(source, sourceName) {
	const protectedSource = protectSource(source);
	const prompt = buildPrompt(protectedSource.text, sourceName);
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const request = fetch(apiEndpoint, {
				method: "POST",
				headers: {
					authorization: `Bearer ${apiKey}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model,
					temperature: 0.2,
					max_tokens: Math.min(20_000, Math.max(5_000, Math.ceil(source.length * 3))),
					messages: [
						{ role: "system", content: "You translate Markdown accurately and return only Markdown." },
						{ role: "user", content: prompt },
					],
				}),
				signal: controller.signal,
			});
			const response = await Promise.race([
				request,
				new Promise((_, reject) => setTimeout(() => reject(new Error(`translation API timed out after ${timeoutMs}ms`)), timeoutMs)),
			]);
			if (!response.ok) {
				throw new Error(`translation API ${response.status}: ${(await response.text()).slice(0, 500)}`);
			}
			const payload = await response.json();
			const choice = payload?.choices?.[0];
			if (choice?.finish_reason && !["stop", "end_turn"].includes(choice.finish_reason)) {
				throw new Error(`translation API stopped with ${choice.finish_reason}`);
			}
			const content = choice?.message?.content;
			if (!content) throw new Error("translation API returned empty content");
			return restoreProtected(cleanOutput(content), protectedSource.values);
		} catch (error) {
			lastError = error?.name === "AbortError"
				? new Error(`translation API timed out after ${timeoutMs}ms`)
				: error;
			if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
		} finally {
			clearTimeout(timer);
		}
	}
	throw lastError;
}

function translateViaCli(source, sourceName) {
	const protectedSource = protectSource(source);
	const prompt = buildPrompt(protectedSource.text, sourceName);
	return new Promise((resolve, reject) => {
		const command = process.platform === "win32" ? process.execPath : gemini;
		const args = process.platform === "win32"
			? [gemini, "-m", model, "-p", prompt, "--output-format", "text"]
			: ["-m", model, "-p", prompt, "--output-format", "text"];
		const child = spawn(command, args, {
			cwd: blogRoot,
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => { stdout += chunk; });
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error(`Gemini timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code !== 0) {
				reject(new Error(`Gemini exited ${code}: ${stderr.trim().slice(-500)}`));
				return;
			}
			resolve(restoreProtected(cleanOutput(stdout), protectedSource.values));
		});
	});
}

function buildPrompt(source, sourceName) {
	return `You are translating one Markdown source file for Amiya_desi's personal blog.
Source file: ${sourceName}

Return only the complete translated Markdown. Do not add a commentary, a summary, or Markdown fences around the result.

Translation rules:
- Translate human-facing Chinese prose into natural, idiomatic English while keeping the author's candid, compact, slightly self-mocking personal voice. Do not turn it into marketing copy or formal documentation.
- Translate frontmatter title, description, category, tags, alt text, captions, and other human text. Keep dates, booleans, numbers, IDs, model names, product names, usernames, domains, URLs, file paths, image paths, and code identifiers unchanged.
- Preserve the frontmatter keys and ordering as much as possible. Add 'lang: en' and 'translationKey: ${sourceName.replace(/\.(md|mdx)$/i, "")}' if they are absent. Keep draft/published state exactly as the source.
- If the source has no frontmatter, do not invent, add, or wrap the result in frontmatter.
- Preserve every code fence, code block, inline-code span, Markdown heading, list, table, image, link destination, Obsidian embed, wiki-link target, directive name, and HTML attribute. Translate visible link text and wiki-link aliases only.
- For every source heading line beginning with one to six ASCII '#', emit exactly one heading at the same level. Never turn a heading into a paragraph, and never add a new heading.
- Tokens like __PRESERVE_URL_0__, __PRESERVE_BLOCK_0__, __PRESERVE_INLINE_0__, __PRESERVE_EMBED_0__, and __PRESERVE_HEADING_0_2__ are protected source text. Copy them exactly once and do not translate, remove, or reformat them.
- Keep repost attribution, author credit, permission statements, original URLs, and copyright wording factual and intact.
- Do not remove, merge, invent, or reorder paragraphs. Keep the same information density.

Here is the source Markdown:
---BEGIN SOURCE---
${source}
---END SOURCE---`;
}

function normalizeEnglishMetadata(source, translated, sourceName) {
	const sourceFrontmatter = getFrontmatter(source);
	const targetFrontmatter = getFrontmatter(translated);
	if (!sourceFrontmatter) {
		return targetFrontmatter ? targetFrontmatter.body : translated;
	}
	if (!targetFrontmatter) return translated;
	const lineEnding = translated.includes("\r\n") ? "\r\n" : "\n";
	const lines = targetFrontmatter.raw.split(/\r?\n/);
	const sourceLines = sourceFrontmatter.raw.split(/\r?\n/);
	const setLine = (key, value) => {
		const index = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
		const next = `${key}: ${value}`;
		if (index >= 0) lines[index] = next;
		else lines.push(next);
	};
	setLine("lang", "en");
	setLine("translationKey", sourceName.replace(/\.(md|mdx)$/i, ""));
	for (const key of ["draft", "published", "created", "updated", "lastEdited", "encrypted"]) {
		const original = sourceLines.find((line) => new RegExp(`^${key}:`).test(line));
		if (original) setLine(key, original.slice(key.length + 1).trim());
	}
	return `---${lineEnding}${normalizeYamlScalars(lines).join(lineEnding)}${lineEnding}---${lineEnding}${targetFrontmatter.body}`;
}

function normalizeYamlScalars(lines) {
	return lines.map((line) => {
		const match = line.match(/^(\s*[A-Za-z0-9_-]+:\s+)([^[{"'][^\r\n]*)$/);
		if (!match || !/:\s/.test(match[2])) return line;
		return `${match[1]}${JSON.stringify(match[2].trim())}`;
	});
}

function protectSource(source, options = {}) {
	const values = [];
	let text = String(source);
	const protect = (pattern, kind) => {
		text = text.replace(pattern, (value) => {
			const token = `__PRESERVE_${kind}_${values.length}__`;
			values.push([token, value]);
			return token;
		});
	};
	protect(/^(```|~~~)[\s\S]*?^\1[ \t]*$/gm, "BLOCK");
	protect(/`[^`\n]+`/g, "INLINE");
	protect(/!\[\[[^\]]+\]\]/g, "EMBED");
	text = text.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (_match, target, alias = "") => {
		const token = `__PRESERVE_WIKITARGET_${values.length}__`;
		values.push([token, target]);
		return `[[${token}${alias}]]`;
	});
	protect(/https?:\/\/[^\s)\]}"']+/g, "URL");
	if (options.protectGaps) protect(/\r?\n[ \t]*\r?\n+/g, "GAP");
	text = text.replace(/^(#{1,6})[ \t]+(.+)$/gm, (_match, hashes, heading) => {
		const token = `__PRESERVE_HEADING_${values.length}_${hashes.length}__`;
		values.push([token, hashes]);
		return `${token} ${heading}`;
	});
	return { text, values };
}

function restoreProtected(value, values) {
	let output = String(value);
	for (const [token, original] of values) {
		output = output.replaceAll(token, original);
	}
	return output;
}

function normalizeEndpoint(value) {
	let base = String(value || "").trim().replace(/\/+$/, "");
	if (!base) return "";
	base = base.replace(/\/(?:models|chat\/completions)$/i, "");
	if (!/\/v\d+(?:$|\/)/i.test(base)) base += "/v1";
	return `${base}/chat/completions`;
}

function loadDotEnv(filePath) {
	if (!filePath || !fs.existsSync(filePath)) return {};
	const values = {};
	for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (!match) continue;
		values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
	}
	return values;
}

function cleanOutput(value) {
	let output = String(value).trim();
	output = output.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/i, "").trim();
	return output;
}

function validateTranslation(source, translated, sourcePath) {
	if (!translated || translated.includes("---BEGIN SOURCE---")) {
		throw new Error("empty or echoed prompt output");
	}
	const sourceFrontmatter = getFrontmatter(source);
	const targetFrontmatter = getFrontmatter(translated);
	if (sourceFrontmatter) {
		if (!targetFrontmatter) throw new Error("frontmatter was lost");
		for (const key of sourceFrontmatter.keys) {
			if (!targetFrontmatter.keys.has(key)) throw new Error(`frontmatter key lost: ${key}`);
		}
		if (!/^lang:\s*en\s*$/mi.test(targetFrontmatter.raw)) {
			throw new Error("missing lang: en");
		}
	} else if (targetFrontmatter) {
		throw new Error("frontmatter was added to a plain Markdown source");
	}
	const sourceBody = sourceFrontmatter?.body || source;
	const targetBody = targetFrontmatter?.body || translated;
	const count = (text, pattern) => (text.match(pattern) || []).length;
	if (count(sourceBody, /^\s*(```|~~~)/gm) !== count(targetBody, /^\s*(```|~~~)/gm)) {
		throw new Error("code fence count changed");
	}
	if (count(sourceBody, /^#{1,6}\s+/gm) !== count(targetBody, /^#{1,6}\s+/gm)) {
		throw new Error("heading count changed");
	}
	const urls = [...source.matchAll(/https?:\/\/[^\s)\]>'"`(]+/g)].map((match) => match[0].replace(/[.,，。]+$/, ""));
	for (const url of urls) {
		if (!translated.includes(url)) throw new Error(`URL lost: ${url}`);
	}
	const embeds = count(sourceBody, /!\[\[/g);
	if (embeds !== count(targetBody, /!\[\[/g)) throw new Error("Obsidian embed count changed");
	const wikiTargets = [...sourceBody.matchAll(/(?<!\!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((match) => match[1]);
	for (const target of wikiTargets) {
		if (!targetBody.includes(`[[${target}`)) throw new Error(`wiki-link target changed: ${target}`);
	}
	if (sourcePath.toLowerCase().includes("\\site\\") && sourceFrontmatter && !targetFrontmatter.raw.includes("lang: en")) {
		throw new Error("site translation missing language");
	}
}

function getFrontmatter(value) {
	const match = String(value).replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return null;
	const keys = new Set(
		match[1].split(/\r?\n/).map((line) => line.match(/^([A-Za-z0-9_-]+):/)?.[1]).filter(Boolean),
	);
	return { raw: match[1], keys, body: match[2] };
}

function* walk(directory) {
	if (!fs.existsSync(directory)) return;
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const current = path.join(directory, entry.name);
		if (entry.isDirectory()) yield* walk(current);
		else yield current;
	}
}

function relative(filePath) {
	return path.relative(articlesRoot, filePath).replaceAll("\\", "/");
}
