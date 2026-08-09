import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const blogRoot = path.resolve(path.dirname(scriptFile), "..");
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const SAYORI_LINK_RE = /(?:https?:\/\/)?(?:blog\.)?sayori\.org(?:[/?#]|$)/i;

export function parseFrontmatter(content) {
	const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) return {};

	const frontmatter = {};
	for (const line of match[1].split(/\r?\n/)) {
		const field = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
		if (!field) continue;
		frontmatter[field[1]] = parseScalar(field[2]);
	}
	return frontmatter;
}

function parseScalar(value) {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1).replace(/\\([\\"'])/g, "$1");
	}
	return value;
}

export function normalizeUrl(value) {
	const url = new URL(String(value).trim());
	if (!/^https?:$/.test(url.protocol)) {
		throw new Error(`unsupported URL protocol: ${url.protocol}`);
	}
	url.hash = "";
	if (!url.search) url.search = "";
	return url.href;
}

function friendKey(url) {
	const parsed = new URL(url);
	parsed.hash = "";
	parsed.search = "";
	parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
	return parsed.href.toLowerCase();
}

export function readFriends(sourceDir) {
	if (!fs.existsSync(sourceDir)) throw new Error(`friends directory missing: ${sourceDir}`);

	return walk(sourceDir)
		.filter((filePath) => /\.(?:md|mdx)$/i.test(filePath))
		.sort((a, b) => a.localeCompare(b))
		.map((filePath) => {
			const frontmatter = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
			if (!frontmatter.siteurl) return null;
			const siteUrl = normalizeUrl(frontmatter.siteurl);
			return {
				title: String(frontmatter.title || path.basename(filePath, path.extname(filePath))),
				siteUrl,
				linkPage: frontmatter.linkpage ? normalizeUrl(frontmatter.linkpage) : null,
				visible: frontmatter.visible !== "false",
				key: friendKey(siteUrl),
				source: path.relative(sourceDir, filePath).replaceAll(path.sep, "/"),
			};
		})
		.filter(Boolean);
}

function walk(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = path.join(directory, entry.name);
		return entry.isDirectory() ? walk(fullPath) : [fullPath];
	});
}

export async function checkFriends(friends, options = {}) {
	const fetchImpl = options.fetchImpl || fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const attempts = Math.max(1, Number(options.attempts ?? DEFAULT_ATTEMPTS));
	const retryDelayMs = Math.max(0, Number(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
	const now = options.now || (() => new Date().toISOString());

	const results = [];
	for (const friend of friends) {
		if (!friend.visible) {
			results.push({
				title: friend.title,
				siteUrl: friend.siteUrl,
				status: "disabled",
				backlink: { status: "not_checked" },
				checkedAt: null,
				source: friend.source,
			});
			continue;
		}

		const site = await requestWithRetry(friend.siteUrl, {
			fetchImpl,
			timeoutMs,
			attempts,
			retryDelayMs,
			now,
		});
		const backlink = friend.linkPage
			? await requestWithRetry(friend.linkPage, {
					fetchImpl,
					timeoutMs,
					attempts,
					retryDelayMs,
					now,
					readBody: true,
				})
			: { status: "not_configured" };

		results.push({
			title: friend.title,
			siteUrl: friend.siteUrl,
			status: site.status,
			httpStatus: site.httpStatus,
			latencyMs: site.latencyMs,
			attempts: site.attempts,
			error: site.error,
			backlink: friend.linkPage
				? {
					status: backlink.status === "up"
						? SAYORI_LINK_RE.test(backlink.body)
							? "found"
							: "missing"
						: backlink.status,
					httpStatus: backlink.httpStatus,
					latencyMs: backlink.latencyMs,
					attempts: backlink.attempts,
					error: backlink.error,
				}
				: backlink,
			checkedAt: now(),
			source: friend.source,
		});
	}
	return results;
}

async function requestWithRetry(url, options) {
	let last = null;
	for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
		last = await requestOnce(url, { ...options, attempt });
		if (last.status === "up" || last.status === "missing") return last;
		if (attempt < options.attempts && options.retryDelayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));
		}
	}
	return last;
}

async function requestOnce(url, options) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs);
	const started = performance.now();
	try {
		const response = await options.fetchImpl(url, {
			method: "GET",
			redirect: "follow",
			signal: controller.signal,
			headers: {
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"User-Agent": "sayori-friend-check/1.0 (+https://blog.sayori.org/friends/)",
			},
		});
		const latencyMs = Math.max(0, Math.round(performance.now() - started));
		const body = options.readBody ? await readLimitedText(response) : "";
		if (!options.readBody) await cancelBody(response);
		const status = response.status >= 200 && response.status < 400 ? "up" : "http_error";
		return {
			status,
			httpStatus: response.status,
			latencyMs,
			attempts: options.attempt,
			body,
		};
	} catch (error) {
		const latencyMs = Math.max(0, Math.round(performance.now() - started));
		const timedOut = error?.name === "AbortError";
		return {
			status: timedOut ? "timeout" : "network_error",
			latencyMs,
			attempts: options.attempt,
			error: timedOut ? "request timed out" : String(error?.message || "request failed").slice(0, 160),
		};
	} finally {
		clearTimeout(timer);
	}
}

async function readLimitedText(response, maxBytes = DEFAULT_MAX_BODY_BYTES) {
	if (!response.body) return await response.text();
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let text = "";
	try {
		while (text.length < maxBytes) {
			const { done, value } = await reader.read();
			if (done) break;
			text += decoder.decode(value, { stream: true });
		}
		return text.slice(0, maxBytes);
	} finally {
		await reader.cancel().catch(() => {});
	}
}

async function cancelBody(response) {
	try {
		await response.body?.cancel();
	} catch {
		// The status result is still useful when a server refuses cancellation.
	}
}

export function mergeResults(friends, checkedResults, previousResults = [], target = "") {
	const checked = new Map(checkedResults.map((result) => [friendKey(result.siteUrl), result]));
	const previous = new Map(previousResults.map((result) => [friendKey(result.siteUrl), result]));
	const targetValue = target.trim().toLowerCase();
	return friends.map((friend) => {
		if (!targetValue || targetMatches(friend, targetValue)) {
			return checked.get(friend.key) || previous.get(friend.key) || notChecked(friend);
		}
		return previous.get(friend.key) || notChecked(friend);
	});
}

function notChecked(friend) {
	return {
		title: friend.title,
		siteUrl: friend.siteUrl,
		status: "not_checked",
		backlink: friend.linkPage ? { status: "not_checked" } : { status: "not_configured" },
		checkedAt: null,
		source: friend.source,
	};
}

function targetMatches(friend, target) {
	if (!target) return true;
	if (friend.title.toLowerCase() === target) return true;
	try {
		return friend.key === friendKey(normalizeUrl(target));
	} catch {
		return false;
	}
}

function parseArgs(argv) {
	const args = { target: String(process.env.FRIEND_TARGET || "").trim() };
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--target") args.target = String(argv[index + 1] || "").trim();
	}
	return args;
}

function resolveSourceDirectory() {
	const configured = String(process.env.FRIEND_SOURCE_DIR || process.env.CONTENT_DIR || "").trim();
	const contentRoot = path.resolve(blogRoot, configured || path.join("..", "sayori-articles"));
	return path.basename(contentRoot).toLowerCase() === "friends" ? contentRoot : path.join(contentRoot, "friends");
}

function readPreviousResults(outputPath) {
	if (!fs.existsSync(outputPath)) return [];
	const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
	if (!Array.isArray(parsed.results)) throw new Error(`invalid friend status file: ${outputPath}`);
	return parsed.results;
}

export async function runCheck({ sourceDir = resolveSourceDirectory(), outputPath = path.join(blogRoot, "public", "data", "friend-status.json"), target = "", ...options } = {}) {
	const friends = readFriends(sourceDir);
	if (target && !friends.some((friend) => targetMatches(friend, target.toLowerCase()))) {
		throw new Error(`friend target not found: ${target}`);
	}
	const checkedResults = await checkFriends(
		target ? friends.filter((friend) => targetMatches(friend, target.toLowerCase())) : friends,
		options,
	);
	const previousResults = readPreviousResults(outputPath);
	const results = mergeResults(friends, checkedResults, previousResults, target);
	const output = {
		version: 1,
		checkedAt: new Date().toISOString(),
		target: target || null,
		results,
	};

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	const temporaryPath = `${outputPath}.tmp`;
	fs.writeFileSync(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
	fs.renameSync(temporaryPath, outputPath);
	return output;
}

if (path.resolve(process.argv[1] || "") === scriptFile) {
	const args = parseArgs(process.argv.slice(2));
	runCheck({
		target: args.target,
		timeoutMs: Number(process.env.FRIEND_CHECK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
		attempts: Number(process.env.FRIEND_CHECK_ATTEMPTS || DEFAULT_ATTEMPTS),
		retryDelayMs: Number(process.env.FRIEND_CHECK_RETRY_DELAY_MS || DEFAULT_RETRY_DELAY_MS),
	})
		.then((output) => {
			const summary = output.results.reduce((counts, result) => {
				counts[result.status] = (counts[result.status] || 0) + 1;
				return counts;
			}, {});
			console.log(`[friend-check] checked ${output.results.length} friend(s): ${JSON.stringify(summary)}`);
		})
		.catch((error) => {
			console.error(`[friend-check] ${error.message}`);
			process.exitCode = 1;
		});
}
