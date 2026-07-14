import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const blogRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(blogRoot, "dist");

const ALWAYS_BLOCKING_PATTERNS = [
	"MainGridLayout.",
	"banner.",
	"mobile-post-list-fix.",
	"transition.",
	"variables.",
	"widget-responsive.",
];

const ARTICLE_BLOCKING_PATTERNS = [
	"katex.",
	"markdown.",
	"markdown-extend.",
	"expressive-code.",
	"encrypted-content.",
	"Markdown.",
];

const PAGE_BLOCKING_PATTERNS = [
	{ pathPrefix: "/admin/", patterns: ["admin."] },
	{ pathPrefix: "/timeline/", patterns: ["timeline."] },
	{ pathPrefix: "/guestbook/", patterns: ["twikoo."] },
];

if (!fs.existsSync(distDir)) {
	throw new Error(`dist directory not found: ${distDir}`);
}

let filesChanged = 0;
let linksDeferred = 0;

for (const htmlPath of findHtmlFiles(distDir)) {
	const original = fs.readFileSync(htmlPath, "utf8");
	const routePath = toRoutePath(htmlPath);
	let pageDeferred = 0;

	const html = original.replace(
		/<link rel="stylesheet" href="([^"]+\.css)">/g,
		(match, href) => {
			if (shouldKeepBlocking(routePath, href)) {
				return match;
			}
			pageDeferred++;
			return [
				`<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">`,
				`<noscript><link rel="stylesheet" href="${href}"></noscript>`,
			].join("");
		},
	);

	if (html !== original) {
		fs.writeFileSync(htmlPath, html);
		filesChanged++;
		linksDeferred += pageDeferred;
	}
}

console.log(
	`[optimize-html-assets] deferred ${linksDeferred} stylesheet link${linksDeferred === 1 ? "" : "s"} in ${filesChanged} HTML file${filesChanged === 1 ? "" : "s"}`,
);

function shouldKeepBlocking(routePath, href) {
	const fileName = path.basename(href);
	if (ALWAYS_BLOCKING_PATTERNS.some((pattern) => fileName.includes(pattern))) {
		return true;
	}

	if (
		(routePath.startsWith("/posts/") || routePath === "/about/") &&
		ARTICLE_BLOCKING_PATTERNS.some((pattern) => fileName.includes(pattern))
	) {
		return true;
	}

	for (const pageRule of PAGE_BLOCKING_PATTERNS) {
		if (
			routePath.startsWith(pageRule.pathPrefix) &&
			pageRule.patterns.some((pattern) => fileName.includes(pattern))
		) {
			return true;
		}
	}

	return false;
}

function* findHtmlFiles(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* findHtmlFiles(fullPath);
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			yield fullPath;
		}
	}
}

function toRoutePath(htmlPath) {
	const relative = path.relative(distDir, htmlPath).replaceAll(path.sep, "/");
	if (relative === "index.html") {
		return "/";
	}
	if (relative.endsWith("/index.html")) {
		return `/${relative.slice(0, -"index.html".length)}`;
	}
	if (relative.endsWith(".html")) {
		return `/${relative.slice(0, -".html".length)}/`;
	}
	return `/${relative}`;
}
