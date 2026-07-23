import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.js";

const scriptFile = fileURLToPath(import.meta.url);
const blogRoot = path.resolve(path.dirname(scriptFile), "..");
const workspaceRoot = path.resolve(blogRoot, "..");
const localReposRoot = workspaceRoot;
loadEnv();
const configuredContentDir = String(process.env.CONTENT_DIR || "").trim();
const articlesRoot = configuredContentDir
	? path.resolve(blogRoot, configuredContentDir)
	: path.join(localReposRoot, "sayori-articles");
const repoRoot = articlesRoot;
const contentPathspec = ".";
const BLOG_MEDIA_BASE_URL = String(process.env.BLOG_MEDIA_BASE_URL || "")
	.trim()
	.replace(/\/+$/, "");
const BLOG_MEDIA_MANIFEST_PATH = path.resolve(
	blogRoot,
	String(process.env.BLOG_MEDIA_MANIFEST || path.join(".cache", "blog-media", "manifest.json")),
);
const BLOG_MEDIA_MANIFEST = loadBlogMediaManifest();
const BLOG_MEDIA_INDEX = buildBlogMediaIndex(BLOG_MEDIA_MANIFEST);
const USE_REMOTE_BLOG_MEDIA = Boolean(BLOG_MEDIA_BASE_URL);

const POSTS_SRC = path.join(articlesRoot, "posts");
const POSTS_DEST = path.join(blogRoot, "src", "content", "posts");
const ESSAYS_SRC = path.join(articlesRoot, "essays");
const ESSAYS_DEST = path.join(blogRoot, "src", "content", "essays");
const IMAGES_DEST = path.join(blogRoot, "public", "images");
const POST_IMAGES_DEST = path.join(IMAGES_DEST, "posts");
const SITE_CONFIG_SRC = path.join(articlesRoot, "site");
const SITE_CONTENT_DEST = path.join(blogRoot, "src", "content", "site");
const SITE_ASSETS_SRC = path.join(articlesRoot, "assets");
const ANIME_SRC = path.join(articlesRoot, "anime");
const FRIENDS_SRC = path.join(articlesRoot, "friends");
const PUBLIC_ASSETS_DEST = path.join(blogRoot, "public", "assets");
const ANIME_PUBLIC_DEST = path.join(PUBLIC_ASSETS_DEST, "anime");
const ANIME_DATA_DEST = path.join(blogRoot, "src", "data", "anime.ts");
const GENERATED_CONFIG_DEST = path.join(blogRoot, "src", "generated", "obsidian-config.ts");
const GENERATED_FRIENDS_DEST = path.join(blogRoot, "src", "generated", "friends.ts");
const GENERATED_FRIEND_SCREENSHOTS_DEST = path.join(
	blogRoot,
	"functions",
	"_generated",
	"friend-screenshot-targets.js",
);
const GENERATED_FRIEND_UPDATES_DEST = path.join(
	blogRoot,
	"functions",
	"_generated",
	"friend-update-sources.js",
);

const IMAGE_EXTS = new Set([
	".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp",
]);
const MEDIA_EXTS = new Set([
	...IMAGE_EXTS, ".mp3", ".ogg", ".wav", ".mp4", ".webm", ".pdf",
]);
const IMAGE_ALIGNMENTS = new Set(["left", "center", "right"]);

const PUBLIC_WIKI_ALIASES = new Map([
	["小故事_近期美术练习与理论补充计划", "little-story-art-learning-plan"],
	["Outcore", "outcore-afterthought"],
	["参加动漫社活动有感", "anime-club-event-reflection"],
	["开源思考和自身思考", "open-source-and-self-reflection"],
]);

const PRIVATE_WIKI_TARGETS = new Set([
	"Boundary Window",
	"Boundary Window_设定_2026-04-28",
	"Boundary_Window_Stage1设计边界_2026-04-30",
	"Dankoe的重启人生自查问题",
	"一些想说的话",
]);

const warnings = [];

if (!fs.existsSync(articlesRoot)) {
	failSync(`content root missing: ${articlesRoot}`);
}

for (const directory of ["posts", "essays", "spec", "site", "assets", "friends", "anime"]) {
	const directoryPath = path.join(articlesRoot, directory);
	if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
		failSync(`required directory missing: ${directory}`);
	}
}

for (const filename of [
	"profile.json",
	"banner.json",
	"navigation.json",
	"announcement.json",
	"sponsor.json",
	"music.json",
]) {
	validateRequiredJsonFile(path.join(SITE_CONFIG_SRC, filename));
}

const sponsorPagePath = path.join(SITE_CONFIG_SRC, "sponsor.md");
if (!fs.existsSync(sponsorPagePath) || !fs.statSync(sponsorPagePath).isFile()) {
	failSync("required file missing: site/sponsor.md");
}

printArticleChangeSummary(collectArticleChangeSummary());

const contentIndex = buildContentIndex([
	{ dir: POSTS_SRC, urlPrefix: "/posts/" },
	{ dir: ESSAYS_SRC, urlPrefix: "/essays/#" },
]);

// --- Sync global images ---
const imagesSrc = path.join(articlesRoot, "images");
fs.rmSync(IMAGES_DEST, { recursive: true, force: true });
fs.mkdirSync(IMAGES_DEST, { recursive: true });
if (fs.existsSync(imagesSrc)) {
	copyDirectory(imagesSrc, IMAGES_DEST, { transformMarkdown: false, slug: null });
	console.log(`[sync-content] images: articles/images -> blog/public/images`);
}

// --- Sync albums ---
const albumsSrc = path.join(articlesRoot, "albums");
const albumsDest = path.join(IMAGES_DEST, "albums");
if (fs.existsSync(albumsSrc)) {
	fs.mkdirSync(albumsDest, { recursive: true });
	copyDirectory(albumsSrc, albumsDest, { transformMarkdown: false, slug: null });
	console.log(`[sync-content] albums: articles/albums -> blog/public/images/albums`);
}

// --- Sync posts (folder-per-post aware) ---
fs.rmSync(POSTS_DEST, { recursive: true, force: true });
fs.mkdirSync(POSTS_DEST, { recursive: true });

syncPosts(POSTS_SRC, POSTS_DEST, []);
fs.mkdirSync(POST_IMAGES_DEST, { recursive: true });
console.log(`[sync-content] posts: articles/posts -> blog/src/content/posts`);

// --- Sync essays (single-file markdown only) ---
fs.rmSync(ESSAYS_DEST, { recursive: true, force: true });
fs.mkdirSync(ESSAYS_DEST, { recursive: true });

syncEssays(ESSAYS_SRC, ESSAYS_DEST);
console.log(`[sync-content] essays: articles/essays -> blog/src/content/essays`);

// --- Sync spec ---
const specSrc = path.join(articlesRoot, "spec");
const specDest = path.join(blogRoot, "src", "content", "spec");
if (fs.existsSync(specSrc)) {
	fs.rmSync(specDest, { recursive: true, force: true });
	fs.mkdirSync(specDest, { recursive: true });
	copyDirectory(specSrc, specDest, { transformMarkdown: true, slug: null });
	console.log(`[sync-content] spec: articles/spec -> blog/src/content/spec`);
}

// --- Sync Obsidian-managed site settings and public assets ---
syncSiteAssets();
syncAnimeData();
syncSiteConfig();
syncFriendsData();

if (warnings.length > 0) {
	console.error("\n[sync-content] validation errors:");
	for (const warning of warnings) {
		console.error(`  - ${warning}`);
	}
	failSync("content validation failed");
}

console.log("[sync-content] done");

function failSync(message) {
	console.error(`[sync-content] ${message}`);
	process.exit(1);
}

function validateRequiredJsonFile(filePath) {
	const label = path.relative(articlesRoot, filePath).replaceAll("\\", "/");
	if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
		failSync(`required file missing: ${label}`);
	}
	try {
		const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			failSync(`${label} must contain a JSON object`);
		}
	} catch (error) {
		failSync(`${label} parse failed: ${error.message}`);
	}
}

// ─── Posts sync (folder-per-post aware) ───────────────────────────────────────

function syncPosts(srcDir, destDir, segments) {
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const sourcePath = path.join(srcDir, entry.name);

		if (entry.isDirectory()) {
			if (isPostFolder(sourcePath, entry.name)) {
				syncPostFolder(sourcePath, destDir, [...segments, entry.name]);
			} else {
				const subDest = path.join(destDir, entry.name);
				fs.mkdirSync(subDest, { recursive: true });
				syncPosts(sourcePath, subDest, [...segments, entry.name]);
			}
			continue;
		}

		if (/\.(md|mdx)$/i.test(entry.name)) {
			const slug = [...segments, entry.name.replace(/\.(md|mdx)$/i, "")].join("/");
			const original = fs.readFileSync(sourcePath, "utf8");
			const transformed = transformMarkdown(original, sourcePath, slug);
			fs.writeFileSync(path.join(destDir, entry.name), transformed);
		}
	}
}

function isPostFolder(dirPath, dirName) {
	const entries = fs.readdirSync(dirPath);
	return entries.some(
		(e) => /\.(md|mdx)$/i.test(e) && (
			e.replace(/\.(md|mdx)$/i, "").toLowerCase() === dirName.toLowerCase() ||
			e.toLowerCase() === "index.md" || e.toLowerCase() === "index.mdx"
		),
	);
}

function syncPostFolder(srcDir, destDir, segments) {
	const dirName = segments[segments.length - 1];
	const slug = segments.map(slugify).join("/");
	const imageSegments = slug.split("/").filter(Boolean);
	const postDestDir = path.join(destDir, dirName);
	fs.mkdirSync(postDestDir, { recursive: true });

	let mainMd = null;
	const assets = [];

	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const sourcePath = path.join(srcDir, entry.name);

		if (entry.isDirectory()) {
			// Sub-directories in a post folder are asset folders
			const assetDestDir = path.join(POST_IMAGES_DEST, ...imageSegments);
			fs.mkdirSync(path.join(assetDestDir, entry.name), { recursive: true });
			copyDirectory(sourcePath, path.join(assetDestDir, entry.name), {
				transformMarkdown: false,
				slug: null,
				skipImages: USE_REMOTE_BLOG_MEDIA,
			});
			continue;
		}

		if (/\.(md|mdx)$/i.test(entry.name)) {
			const baseName = entry.name.replace(/\.(md|mdx)$/i, "").toLowerCase();
			if (baseName === dirName.toLowerCase() || baseName === "index") {
				mainMd = sourcePath;
			} else {
				// Additional markdown files in the folder — copy as-is
				const content = fs.readFileSync(sourcePath, "utf8");
				fs.writeFileSync(path.join(postDestDir, entry.name), transformMarkdown(content, sourcePath, slug));
			}
		} else if (MEDIA_EXTS.has(path.extname(entry.name).toLowerCase())) {
			assets.push(entry.name);
		} else {
			assets.push(entry.name);
		}
	}

	// Copy assets to public/images/posts/<slug>/
	if (assets.length > 0) {
		const assetDest = path.join(POST_IMAGES_DEST, ...imageSegments);
		fs.mkdirSync(assetDest, { recursive: true });
		for (const asset of assets) {
			if (USE_REMOTE_BLOG_MEDIA && IMAGE_EXTS.has(path.extname(asset).toLowerCase())) {
				continue;
			}
			fs.copyFileSync(path.join(srcDir, asset), path.join(assetDest, asset));
		}
	}

	// Write main markdown as index.md
	if (mainMd) {
		const original = fs.readFileSync(mainMd, "utf8");
		const transformed = transformMarkdown(original, mainMd, slug);
		fs.writeFileSync(path.join(postDestDir, "index.md"), transformed);
	}
}

function syncEssays(srcDir, destDir) {
	if (!fs.existsSync(srcDir)) {
		return;
	}

	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const sourcePath = path.join(srcDir, entry.name);
		if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) {
			continue;
		}

		const slug = entry.name.replace(/\.(md|mdx)$/i, "");
		const original = fs.readFileSync(sourcePath, "utf8");
		const transformed = transformMarkdown(original, sourcePath, slug);
		fs.writeFileSync(path.join(destDir, entry.name), transformed);
	}
}

// ─── Markdown transformation ──────────────────────────────────────────────────

function transformMarkdown(content, sourcePath, slug) {
	const { frontmatter, body } = splitFrontmatter(content);
	const transformed = transformMarkdownBody(body, sourcePath, slug);
	return `${frontmatter}${transformed}`;
}

function transformMarkdownBody(content, sourcePath, slug) {
	return transformNonCodeBlocks(content, (segment) => {
		let result = segment;
		result = stripObsidianComments(result);
		result = convertPhotoGrids(result, sourcePath, slug);
		result = convertSpoilers(result);
		result = convertObsidianEmbeds(result, sourcePath, slug);
		result = convertWikiLinks(result, sourcePath);
		result = normalizeImageLinks(result, slug);
		result = convertObsidianBlockIds(result);
		result = convertObsidianHighlights(result);
		return result;
	});
}

function splitFrontmatter(content) {
	const match = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
	if (!match) {
		return { frontmatter: "", body: content };
	}
	return { frontmatter: match[1], body: match[2] };
}

function transformNonCodeBlocks(content, transform) {
	const fencePattern = /^(```|~~~)[^\n]*\r?\n[\s\S]*?^\1[ \t]*$/gm;
	let result = "";
	let cursor = 0;
	let match;

	while ((match = fencePattern.exec(content)) !== null) {
		result += transformNonInlineCode(content.slice(cursor, match.index), transform);
		result += match[0];
		cursor = match.index + match[0].length;
	}

	result += transformNonInlineCode(content.slice(cursor), transform);
	return result;
}

function transformNonInlineCode(content, transform) {
	let result = "";
	let cursor = 0;

	while (cursor < content.length) {
		const openerIndex = content.indexOf("`", cursor);
		if (openerIndex < 0) {
			result += transform(content.slice(cursor));
			break;
		}

		const tickCount = countBackticks(content, openerIndex);
		const closerIndex = content.indexOf("`".repeat(tickCount), openerIndex + tickCount);
		if (closerIndex < 0) {
			result += transform(content.slice(cursor));
			break;
		}

		result += transform(content.slice(cursor, openerIndex));
		result += content.slice(openerIndex, closerIndex + tickCount);
		cursor = closerIndex + tickCount;
	}

	return result;
}

function countBackticks(content, start) {
	let count = 0;
	while (content[start + count] === "`") {
		count++;
	}
	return count;
}

function stripObsidianComments(content) {
	return content.replace(/%%[\s\S]*?%%/g, "");
}

function convertObsidianHighlights(content) {
	return content.replace(/==([^=\n]+)==/g, (_match, text) => `<mark>${text}</mark>`);
}

function convertSpoilers(content) {
	return content.replace(/\{\{(?:spoiler|黑幕)\s*[:：]\s*([^|{}\n]+?)(?:\|([^{}\n]*))?\}\}/g, (_match, rawText, rawTooltip = "") => {
		const text = String(rawText || "").trim();
		const tooltip = String(rawTooltip || "").trim();
		const attrs = [
			'class="sayori-spoiler"',
			'tabindex="0"',
			tooltip ? `data-tooltip="${escapeHtml(tooltip)}"` : "",
			tooltip ? `aria-label="${escapeHtml(tooltip)}"` : "",
		].filter(Boolean).join(" ");
		return `<span ${attrs}>${escapeHtml(text)}</span>`;
	});
}

function convertPhotoGrids(content, sourcePath, slug) {
	return content.replace(/^:::(?:photo-grid|gallery)(?:[ \t]+columns=(\d+))?[ \t]*\r?\n([\s\S]*?)^:::[ \t]*$/gm, (match, rawColumns, body) => {
		const items = [];

		for (const rawLine of String(body || "").split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line) {
				continue;
			}

			const item = parsePhotoGridItem(line, slug);
			if (item) {
				items.push(item);
				continue;
			}

			warnings.push(`${path.relative(repoRoot, sourcePath)}: photo-grid 中无法解析图片 ${line}`);
		}

		if (items.length === 0) {
			return match;
		}

		const columns = normalizePhotoGridColumns(rawColumns, items.length);
		const figures = items.map((item) => {
			const attrs = buildImageAttrs(item, { lazy: true });
			const caption = item.caption
				? `\n<figcaption>${escapeHtml(item.caption)}</figcaption>`
				: "";
			const classes = ["sayori-photo-grid-item"];
			if (item.align) {
				classes.push(`sayori-figure--${item.align}`);
			}
			const style = item.cssWidth
				? ` style="--sayori-image-width: ${escapeHtml(item.cssWidth)};"`
				: "";
			return `<figure class="${classes.join(" ")}"${style}>\n<img ${attrs} />${caption}\n</figure>`;
		}).join("\n");

		return `\n<div class="sayori-photo-grid" style="--photo-grid-columns: ${columns};">\n${figures}\n</div>\n`;
	});
}

function parsePhotoGridItem(line, slug) {
	const obsidianMatch = line.match(/^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/);
	if (obsidianMatch) {
		const filename = obsidianMatch[1].trim();
		const option = obsidianMatch[2] || "";
		const display = parseObsidianEmbedOption(option, filename);
		const ext = path.extname(stripUrlSuffix(filename)).toLowerCase();

		if (!IMAGE_EXTS.has(ext)) {
			return null;
		}

		return {
			src: slug
				? publicPath("images", "posts", slug, filename)
				: publicPath("images", "posts", filename),
			altText: display.altText,
			caption: display.caption || (display.legacyCaption ? display.altText : ""),
			width: display.width || "",
			height: display.height || "",
			cssWidth: display.cssWidth || "",
			align: display.align || "",
		};
	}

	const markdownMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
	if (markdownMatch) {
		const altText = markdownMatch[1].trim();
		const src = normalizeMarkdownImageUrl(markdownMatch[2], slug);
		if (!src || src.startsWith("#")) {
			return null;
		}

		return {
			src,
			altText: altText || path.basename(stripUrlSuffix(markdownMatch[2].trim())),
			caption: altText,
			width: "",
			height: "",
			cssWidth: "",
			align: "",
		};
	}

	return null;
}

function normalizePhotoGridColumns(rawColumns, itemCount) {
	const parsed = Number.parseInt(String(rawColumns || ""), 10);
	if (Number.isFinite(parsed) && parsed > 0) {
		return Math.min(parsed, 4);
	}
	return Math.min(Math.max(itemCount, 1), 2);
}

function convertObsidianEmbeds(content, sourcePath, slug) {
	return content.replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, target, option) => {
		const filename = target.trim();
		const display = parseObsidianEmbedOption(option, filename);
		const ext = path.extname(stripUrlSuffix(filename)).toLowerCase();

		if (IMAGE_EXTS.has(ext)) {
			const src = slug
				? publicPath("images", "posts", slug, filename)
				: publicPath("images", "posts", filename);

			if (display.rich) {
				return renderImageFigure({
					src,
					altText: display.altText,
					caption: display.caption,
					width: display.width || "",
					height: display.height || "",
					cssWidth: display.cssWidth || "",
					align: display.align || "center",
				});
			}

			if (display.width || display.height) {
				const attrs = buildImageAttrs({
					src,
					altText: display.altText,
					width: display.width,
					height: display.height,
				});
				return `<img ${attrs} />`;
			}

			return `![${display.altText}](${src})`;
		}

		if (MEDIA_EXTS.has(ext)) {
			const href = slug
				? publicPath("images", "posts", slug, filename)
				: publicPath("images", "posts", filename);
			return `[${display.altText}](${href})`;
		}

		// Treat as wiki link to another post
		const key = normalizeLookupKey(filename);
		const resolved = contentIndex.get(key);
		if (resolved) {
			return `[${display.altText}](${resolved.url})`;
		}

		if (isPrivateWikiTarget(filename)) {
			return display.altText;
		}

		warnings.push(`${path.relative(repoRoot, sourcePath)}: 无法解析嵌入 ${match}`);
		return display.altText;
	});
}

function parseObsidianEmbedOption(option, filename) {
	const value = String(option || "").trim();
	const fallbackAlt = path.basename(stripUrlSuffix(filename));
	const display = {
		altText: fallbackAlt,
		width: "",
		height: "",
		cssWidth: "",
		align: "",
		caption: "",
		legacyCaption: false,
		rich: false,
	};

	if (!value) {
		return display;
	}

	const tokens = value.split("|").map((token) => token.trim()).filter(Boolean);
	const freeTextTokens = [];
	let explicitAlt = "";
	let explicitCaption = "";
	let hasExplicitLayout = false;
	let hasDimension = false;

	for (const token of tokens) {
		const keyValue = token.match(/^([A-Za-z][\w-]*)\s*=\s*(.+)$/);
		if (keyValue) {
			const key = keyValue[1].toLowerCase();
			const rawTokenValue = keyValue[2].trim();
			if (!rawTokenValue) {
				continue;
			}

			if (["width", "w"].includes(key)) {
				const width = parseImageWidth(rawTokenValue);
				if (width) {
					display.width = width.attrWidth || display.width;
					display.cssWidth = width.cssWidth || display.cssWidth;
					hasDimension = true;
					hasExplicitLayout = true;
				}
				continue;
			}

			if (["height", "h"].includes(key)) {
				const height = parseImageHeight(rawTokenValue);
				if (height) {
					display.height = height;
					hasDimension = true;
					hasExplicitLayout = true;
				}
				continue;
			}

			if (["size", "dim", "dimension", "dimensions"].includes(key)) {
				const dimension = parseImageDimension(rawTokenValue);
				if (dimension) {
					display.width = dimension.width || display.width;
					display.height = dimension.height || display.height;
					display.cssWidth = dimension.cssWidth || display.cssWidth;
					hasDimension = true;
					hasExplicitLayout = true;
				}
				continue;
			}

			if (["align", "alignment", "position"].includes(key)) {
				const align = normalizeImageAlign(rawTokenValue);
				if (align) {
					display.align = align;
					hasExplicitLayout = true;
				}
				continue;
			}

			if (["caption", "cap", "figcaption"].includes(key)) {
				explicitCaption = rawTokenValue;
				hasExplicitLayout = true;
				continue;
			}

			if (["alt", "title"].includes(key)) {
				explicitAlt = rawTokenValue;
				continue;
			}
		}

		const dimension = parseImageDimension(token);
		if (dimension) {
			display.width = dimension.width || display.width;
			display.height = dimension.height || display.height;
			display.cssWidth = dimension.cssWidth || display.cssWidth;
			hasDimension = true;
			if (dimension.explicitCssLength) {
				hasExplicitLayout = true;
			}
			continue;
		}

		const align = normalizeImageAlign(token);
		if (align) {
			display.align = align;
			hasExplicitLayout = true;
			continue;
		}

		freeTextTokens.push(token);
	}

	const freeText = freeTextTokens.join(" | ").trim();
	if (explicitAlt) {
		display.altText = explicitAlt;
	} else if (freeText) {
		display.altText = freeText;
	}

	if (explicitCaption) {
		display.caption = explicitCaption;
	} else if (freeText && hasExplicitLayout) {
		display.caption = freeText;
	}

	if (display.caption && !explicitAlt && !freeText) {
		display.altText = display.caption;
	}

	display.legacyCaption = Boolean(freeText || explicitCaption);
	display.rich = Boolean(display.caption || display.align || display.cssWidth && hasExplicitLayout);
	if (display.rich && display.width && !display.cssWidth) {
		display.cssWidth = `${display.width}px`;
	}
	if (!hasDimension && !hasExplicitLayout && freeText) {
		display.altText = freeText;
	}

	return display;
}

function renderImageFigure(item) {
	const align = normalizeImageAlign(item.align) || "center";
	const classes = ["sayori-figure", `sayori-figure--${align}`];
	const style = item.cssWidth
		? ` style="--sayori-image-width: ${escapeHtml(item.cssWidth)};"`
		: "";
	const caption = item.caption
		? `\n<figcaption>${escapeHtml(item.caption)}</figcaption>`
		: "";
	return `\n<figure class="${classes.join(" ")}"${style}>\n<img ${buildImageAttrs(item, { lazy: true })} />${caption}\n</figure>\n`;
}

function buildImageAttrs(item, options = {}) {
	const media = resolveBlogMediaAsset(item.src);
	const src = media?.primaryUrl || item.src;
	let width = item.width || media?.width || "";
	let height = item.height || media?.height || "";
	if (item.width && !item.height && media?.width && media?.height) {
		height = String(Math.max(1, Math.round((Number(item.width) * media.height) / media.width)));
	}
	if (item.height && !item.width && media?.width && media?.height) {
		width = String(Math.max(1, Math.round((Number(item.height) * media.width) / media.height)));
	}
	const variants = (media?.variants || []).filter(
		(variant) => Number.isFinite(variant.width) && variant.url,
	);
	return [
		`src="${escapeHtml(src)}"`,
		`alt="${escapeHtml(item.altText || "")}"`,
		options.lazy || media ? 'loading="lazy"' : "",
		width ? `width="${escapeHtml(width)}"` : "",
		height ? `height="${escapeHtml(height)}"` : "",
		variants.length > 1
			? `srcset="${escapeHtml(variants.map((variant) => `${variant.url} ${variant.width}w`).join(", "))}"`
			: "",
		variants.length > 1 ? 'sizes="(max-width: 768px) 100vw, 46rem"' : "",
		options.lazy || media ? 'decoding="async"' : "",
	]
		.filter(Boolean)
		.join(" ");
}

function parseImageDimension(value) {
	const text = String(value || "").trim();
	const dimension = text.match(/^(\d{1,5})(?:\s*x\s*(\d{1,5}))?$/i);
	if (dimension) {
		return {
			width: dimension[1],
			height: dimension[2] || "",
			cssWidth: "",
			explicitCssLength: false,
		};
	}

	const width = parseImageWidth(text);
	if (width) {
		return {
			width: width.attrWidth || "",
			height: "",
			cssWidth: width.cssWidth,
			explicitCssLength: true,
		};
	}

	return null;
}

function parseImageWidth(value) {
	const text = String(value || "").trim().toLowerCase();
	const numeric = text.match(/^(\d{1,5})(?:px)?$/);
	if (numeric) {
		return {
			attrWidth: numeric[1],
			cssWidth: `${numeric[1]}px`,
		};
	}

	const percent = text.match(/^(\d{1,3})(?:\.\d+)?%$/);
	if (percent) {
		const valueNumber = Number.parseFloat(text);
		if (valueNumber > 0 && valueNumber <= 100) {
			return {
				attrWidth: "",
				cssWidth: `${valueNumber}%`,
			};
		}
		return null;
	}

	const unit = text.match(/^(\d{1,3})(?:\.\d+)?(rem|em|ch|vw|vh)$/);
	if (unit) {
		return {
			attrWidth: "",
			cssWidth: text,
		};
	}

	return null;
}

function parseImageHeight(value) {
	const text = String(value || "").trim().toLowerCase();
	const numeric = text.match(/^(\d{1,5})(?:px)?$/);
	return numeric ? numeric[1] : "";
}

function normalizeImageAlign(value) {
	const text = String(value || "").trim().toLowerCase();
	return IMAGE_ALIGNMENTS.has(text) ? text : "";
}

function convertWikiLinks(content, sourcePath) {
	return content.replace(/\[\[([^\]|#]+)?(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (match, target = "", heading = "", alias = "") => {
		const rawTarget = target.trim();
		const label = (alias || heading || rawTarget).trim();

		if (!rawTarget && heading) {
			return `[${label || heading}](#${normalizeObsidianAnchor(heading)})`;
		}

		if (!rawTarget) {
			return label || match;
		}

		const key = normalizeLookupKey(rawTarget);
		const resolved = contentIndex.get(key);

		if (!resolved) {
			if (isPrivateWikiTarget(rawTarget)) {
				return label || rawTarget;
			}

			warnings.push(`${path.relative(repoRoot, sourcePath)}: 无法解析 ${match}`);
			return label || rawTarget;
		}

		const anchor =
			heading && resolved.url.startsWith("/posts/")
				? `#${normalizeObsidianAnchor(heading)}`
				: "";
		return `[${label || rawTarget}](${resolved.url}${anchor})`;
	});
}

function normalizeImageLinks(content, slug) {
	return content.replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (match, start, rawUrl, end) => {
		const normalizedUrl = normalizeMarkdownImageUrl(rawUrl, slug);
		if (!normalizedUrl) {
			return match;
		}

		return `${start}${normalizedUrl}${end}`;
	});
}

function normalizeMarkdownImageUrl(rawUrl, slug) {
	const url = String(rawUrl || "").trim();

	if (!url || url.startsWith("#")) {
		return "";
	}

	if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
		return resolveBlogMediaAsset(url)?.primaryUrl || url;
	}

	if (url.startsWith("/")) {
		const normalizedPath = encodeInternalPath(url);
		return resolveBlogMediaAsset(normalizedPath)?.primaryUrl || normalizedPath;
	}

	const normalized = url.replaceAll("\\", "/").replace(/^\.\//, "");

	// Co-located image: relative path within post folder
	if (slug && !normalized.includes("/")) {
		return resolveBlogMediaUrl(publicPath("images", "posts", slug, normalized));
	}

	const imagesIndex = normalized.indexOf("images/posts/");
	if (imagesIndex >= 0) {
		return resolveBlogMediaUrl(
			publicPath("images", "posts", normalized.slice(imagesIndex + "images/posts/".length)),
		);
	}

	if (normalized.startsWith("../images/")) {
		return resolveBlogMediaUrl(publicPath("images", normalized.slice("../images/".length)));
	}

	// Relative path with directories — resolve against slug
	if (slug) {
		return resolveBlogMediaUrl(publicPath("images", "posts", slug, normalized));
	}

	return "";
}

function convertObsidianBlockIds(content) {
	return content.replace(/^[ \t]*\^([A-Za-z0-9_-]+)[ \t]*$/gm, (_match, id) => {
		return `<a id="${id}"></a>`;
	});
}

function normalizeObsidianAnchor(value) {
	const clean = String(value || "").trim().replace(/^\^/, "");
	return slugify(clean) || clean;
}

function publicPath(...segments) {
	return encodeInternalPath(`/${segments.join("/")}`);
}

function stripUrlSuffix(value) {
	const text = String(value || "");
	const suffixIndex = firstSuffixIndex(text);
	return suffixIndex >= 0 ? text.slice(0, suffixIndex) : text;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function encodeInternalPath(value) {
	const normalized = value.replaceAll("\\", "/");
	const suffixIndex = firstSuffixIndex(normalized);
	const pathPart = suffixIndex >= 0 ? normalized.slice(0, suffixIndex) : normalized;
	const suffix = suffixIndex >= 0 ? normalized.slice(suffixIndex) : "";
	const encodedPath = pathPart
		.split("/")
		.map((segment) => segment ? encodeURIComponent(decodeURIComponentSafe(segment)) : "")
		.join("/");
	return `${encodedPath}${suffix}`;
}

function firstSuffixIndex(value) {
	const indexes = [value.indexOf("?"), value.indexOf("#")].filter((index) => index >= 0);
	return indexes.length ? Math.min(...indexes) : -1;
}

function decodeURIComponentSafe(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function copyDirectory(src, dest, options) {
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const sourcePath = path.join(src, entry.name);
		const targetPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			fs.mkdirSync(targetPath, { recursive: true });
			copyDirectory(sourcePath, targetPath, options);
			continue;
		}

		if (options.transformMarkdown && /\.(md|mdx)$/i.test(entry.name)) {
			const original = fs.readFileSync(sourcePath, "utf8");
			const transformed = transformMarkdown(original, sourcePath, options.slug);
			fs.writeFileSync(targetPath, transformed);
			continue;
		}

		if (options.skipImages && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
			continue;
		}

		fs.copyFileSync(sourcePath, targetPath);
	}
}

function loadBlogMediaManifest() {
	if (!BLOG_MEDIA_BASE_URL) return null;
	if (!fs.existsSync(BLOG_MEDIA_MANIFEST_PATH)) {
		failSync(`blog media manifest missing: ${BLOG_MEDIA_MANIFEST_PATH}`);
	}
	let manifest;
	try {
		manifest = JSON.parse(fs.readFileSync(BLOG_MEDIA_MANIFEST_PATH, "utf8"));
	} catch (error) {
		failSync(`blog media manifest parse failed: ${error.message}`);
	}
	if (manifest?.version !== 1 || !Array.isArray(manifest.assets)) {
		failSync("blog media manifest must use version 1 and contain an assets array");
	}
	if (String(manifest.baseUrl || "").replace(/\/+$/, "") !== BLOG_MEDIA_BASE_URL) {
		failSync("blog media manifest base URL does not match BLOG_MEDIA_BASE_URL");
	}
	return manifest;
}

function buildBlogMediaIndex(manifest) {
	const index = new Map();
	for (const asset of manifest?.assets || []) {
		for (const value of [
			asset.source?.path,
			asset.source?.publicPath,
			asset.source?.url,
			asset.primaryUrl,
			...(asset.variants || []).map((variant) => variant.url),
		]) {
			for (const key of blogMediaLookupKeys(value)) {
				if (!index.has(key)) index.set(key, asset);
			}
		}
	}
	return index;
}

function resolveBlogMediaAsset(value) {
	for (const key of blogMediaLookupKeys(value)) {
		const asset = BLOG_MEDIA_INDEX.get(key);
		if (asset) return asset;
	}
	return null;
}

function resolveBlogMediaUrl(value) {
	return resolveBlogMediaAsset(value)?.primaryUrl || value;
}

function blogMediaLookupKeys(value) {
	if (typeof value !== "string" || !value.trim()) return [];
	const normalized = value.trim().replaceAll("\\", "/");
	const keys = new Set([normalized]);
	try {
		keys.add(decodeURI(normalized));
	} catch {
		// Keep the original key when a source contains malformed escapes.
	}
	return [...keys];
}

// ─── Site settings/assets sync ────────────────────────────────────────────────

function syncSiteAssets() {
	copyManagedAssetFolder("profile", "profile");
	copyManagedAssetFolder("banner/desktop", "desktop-banner");
	copyManagedAssetFolder("banner/mobile", "mobile-banner");
	copyManagedAssetFolder("music", "music");
	copyManagedAssetFolder("friends", "friends");
	copyManagedAssetFolder("sponsor", "sponsor");
	copyManagedAssetFolder("about", "about");

	if (fs.existsSync(SITE_ASSETS_SRC)) {
		console.log("[sync-content] site assets: articles/assets -> blog/public/assets");
	}
}

function copyManagedAssetFolder(sourceSegment, targetSegment) {
	const dest = path.join(PUBLIC_ASSETS_DEST, ...targetSegment.split("/"));
	fs.rmSync(dest, { recursive: true, force: true });
	const src = path.join(SITE_ASSETS_SRC, ...sourceSegment.split("/"));
	if (!fs.existsSync(src)) {
		return;
	}
	fs.mkdirSync(dest, { recursive: true });
	copyDirectory(src, dest, { transformMarkdown: false, slug: null });
}

function syncSiteConfig() {
	fs.mkdirSync(path.dirname(GENERATED_CONFIG_DEST), { recursive: true });

	const profile = readJson("profile.json", null);
	const banner = readJson("banner.json", null);
	const navigation = readJson("navigation.json", null);
	const announcement = readJson("announcement.json", null);
	const sponsor = readJson("sponsor.json", null);
	const music = readJson("music.json", null);
	syncSiteContent();
	const generated = [
		"// This file is generated by blog/scripts/sync-content.js.",
		"// Edit articles/spec/site-config-hub.md, articles/site/*.json, and articles/assets/* instead.",
		'import type { AnnouncementConfig, FullscreenWallpaperConfig, MusicPlayerConfig, NavBarConfig, ProfileConfig, SiteConfig, SponsorConfig } from "../types/config";',
		'import { LinkPreset } from "../types/config";',
		'import type { Song } from "../components/widgets/music-player/types";',
		"",
		'type MusicSettingsConfig = {',
		"\tregionAware: boolean;",
		"\tshuffle: boolean;",
		'\tdefaultProvider: "auto" | "netease" | "youtube";',
		"};",
		"",
		`export const profileConfigOverride = ${toTsObject(normalizeProfileConfig(profile))} satisfies Partial<ProfileConfig>;`,
		"",
		`export const bannerConfigOverride = ${toTsObject(normalizeBannerConfig(banner))} satisfies Partial<SiteConfig["banner"]>;`,
		"",
		`export const fullscreenWallpaperConfigOverride = ${toTsObject(normalizeFullscreenWallpaperConfig(banner))} satisfies Partial<FullscreenWallpaperConfig>;`,
		"",
		`export const navBarConfigOverride = ${toTsObject(normalizeNavBarConfig(navigation))} satisfies Partial<NavBarConfig>;`,
		"",
		`export const announcementConfigOverride = ${toTsObject(normalizeAnnouncementConfig(announcement))} satisfies Partial<AnnouncementConfig>;`,
		"",
		`export const sponsorConfigOverride = ${toTsObject(normalizeSponsorConfig(sponsor))} satisfies Partial<SponsorConfig>;`,
		"",
		`export const musicPlayerConfigOverride = ${toTsObject(normalizeMusicPlayerConfig(music))} satisfies Partial<MusicPlayerConfig>;`,
		"",
		`export const localPlaylistOverride = ${toTsObject(normalizeMusicTracks(music))} satisfies Song[];`,
		"",
		`export const musicSettingsOverride = ${toTsObject(normalizeMusicSettings(music))} satisfies MusicSettingsConfig;`,
		"",
	].join("\n");

	fs.writeFileSync(GENERATED_CONFIG_DEST, generated);
	console.log("[sync-content] site config: articles/site -> blog/src/generated/obsidian-config.ts");
}

function syncSiteContent() {
	fs.rmSync(SITE_CONTENT_DEST, { recursive: true, force: true });
	fs.mkdirSync(SITE_CONTENT_DEST, { recursive: true });

	for (const filename of ["sponsor.md"]) {
		const sourcePath = path.join(SITE_CONFIG_SRC, filename);
		if (!fs.existsSync(sourcePath)) {
			continue;
		}
		const slug = filename.replace(/\.(md|mdx)$/i, "");
		const original = fs.readFileSync(sourcePath, "utf8");
		const transformed = transformMarkdown(original, sourcePath, slug);
		fs.writeFileSync(path.join(SITE_CONTENT_DEST, filename), transformed);
	}
}

function syncFriendsData() {
	fs.mkdirSync(path.dirname(GENERATED_FRIENDS_DEST), { recursive: true });

	const friends = [];

	if (fs.existsSync(FRIENDS_SRC)) {
		for (const filePath of walk(FRIENDS_SRC)) {
			if (!/\.(md|mdx)$/i.test(filePath)) {
				continue;
			}

			const content = fs.readFileSync(filePath, "utf8");
			const frontmatter = parseFrontmatter(content);
			const friend = normalizeFriendItem(frontmatter, filePath, friends.length + 1);
			if (friend) {
				friends.push(friend);
			}
		}
	}

	const generated = [
		"// This file is generated by blog/scripts/sync-content.js.",
		"// Edit articles/friends/*.md and articles/assets/friends/* instead.",
		"export interface FriendItem {",
		"\tid: number;",
		"\ttitle: string;",
		"\timgurl: string;",
		"\tdesc: string;",
		"\tsiteurl: string;",
		"\tscreenshotUrl: string;",
		"\tfeedurl: string;",
		"\ttags: string[];",
		"\tposts: FriendPostItem[];",
		"}",
		"",
		"export interface FriendPostItem {",
		"\ttitle: string;",
		"\turl: string;",
		"\texcerpt: string;",
		"\tdate: string;",
		"}",
		"",
		`export const friendsData = ${toTsObject(friends)} satisfies FriendItem[];`,
		"",
		"export function getFriendsList(): FriendItem[] {",
		"\treturn friendsData;",
		"}",
		"",
		"export function getShuffledFriendsList(): FriendItem[] {",
		"\tconst shuffled = [...friendsData];",
		"\tfor (let i = shuffled.length - 1; i > 0; i--) {",
		"\t\tconst j = Math.floor(Math.random() * (i + 1));",
		"\t\t[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];",
		"\t}",
		"\treturn shuffled;",
		"}",
		"",
	].join("\n");

	fs.writeFileSync(GENERATED_FRIENDS_DEST, generated);
	writeFriendScreenshotTargets(friends);
	writeFriendUpdateSources(friends);
	console.log("[sync-content] friends: articles/friends -> blog/src/generated/friends.ts");
}

function writeFriendScreenshotTargets(friends) {
	const screenshotTargets = friends
		.map((friend) => normalizeFriendScreenshotTarget(friend.siteurl))
		.filter(Boolean);
	const generated = [
		"// This file is generated by blog/scripts/sync-content.js.",
		"// It is used by the Pages Function that renders friend-card screenshots.",
		`export const allowedFriendScreenshotUrls = ${toTsObject([...new Set(screenshotTargets)])};`,
		"",
	].join("\n");

	fs.mkdirSync(path.dirname(GENERATED_FRIEND_SCREENSHOTS_DEST), { recursive: true });
	fs.writeFileSync(GENERATED_FRIEND_SCREENSHOTS_DEST, generated);
}

function writeFriendUpdateSources(friends) {
	const updateSources = friends.map((friend) => ({
		title: friend.title,
		siteurl: friend.siteurl,
		imgurl: friend.imgurl,
		desc: friend.desc,
		feedurl: friend.feedurl,
		posts: friend.posts,
	}));
	const generated = [
		"// This file is generated by blog/scripts/sync-content.js.",
		"// It is used by the Pages Function that fetches friend updates.",
		`export const friendUpdateSources = ${toTsObject(updateSources)};`,
		"",
	].join("\n");

	fs.mkdirSync(path.dirname(GENERATED_FRIEND_UPDATES_DEST), { recursive: true });
	fs.writeFileSync(GENERATED_FRIEND_UPDATES_DEST, generated);
}

function syncAnimeData() {
	const statusDirs = ["watching", "completed", "planned"];
	const items = [];

	// anime 目录由 articles/anime 完整托管，先清理旧平铺封面，避免页面引用混乱。
	fs.rmSync(ANIME_PUBLIC_DEST, { recursive: true, force: true });
	fs.mkdirSync(ANIME_PUBLIC_DEST, { recursive: true });
	fs.mkdirSync(path.dirname(ANIME_DATA_DEST), { recursive: true });

	if (fs.existsSync(ANIME_SRC)) {
		for (const status of statusDirs) {
			const dir = path.join(ANIME_SRC, status);
			if (!fs.existsSync(dir)) {
				continue;
			}

			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) {
					continue;
				}
				const sourcePath = path.join(dir, entry.name);
				const content = fs.readFileSync(sourcePath, "utf8");
				const frontmatter = parseFrontmatter(content);
				if (!frontmatter.title) {
					warnings.push(`${path.relative(repoRoot, sourcePath)}: 缺少 title，已忽略`);
					continue;
				}

				const normalized = normalizeAnimeItem(frontmatter, status, sourcePath);
				if (normalized.cover && !normalized.cover.startsWith("http") && !normalized.cover.startsWith("/")) {
					const assetSource = path.join(ANIME_SRC, "assets", status, normalized.cover);
					const assetDest = path.join(ANIME_PUBLIC_DEST, status, normalized.cover);
					if (fs.existsSync(assetSource)) {
						fs.mkdirSync(path.dirname(assetDest), { recursive: true });
						fs.copyFileSync(assetSource, assetDest);
						normalized.cover = `/assets/anime/${status}/${normalized.cover.replaceAll("\\", "/")}`;
					} else {
						warnings.push(`${path.relative(repoRoot, sourcePath)}: 找不到封面 ${path.relative(repoRoot, assetSource)}`);
						normalized.cover = "";
					}
				}

				items.push(normalized);
			}
		}
	}

	const generated = [
		"// This file is generated by blog/scripts/sync-content.js.",
		"// Edit articles/anime/**/*.md and articles/anime/assets/**/* instead.",
		"export interface AnimeItem {",
		"\ttitle: string;",
		'\tstatus: "watching" | "completed" | "planned";',
		"\trating: number;",
		"\tcover: string;",
		"\tdescription: string;",
		"\tepisodes: string;",
		"\tyear: string;",
		"\tgenre: string[];",
		"\tstudio: string;",
		"\tlink: string;",
		"\tprogress: number;",
		"\ttotalEpisodes: number;",
		"\tstartDate: string;",
		"\tendDate: string;",
		"}",
		"",
		`const localAnimeList: AnimeItem[] = ${toTsObject(items)};`,
		"",
		"export default localAnimeList;",
		"",
	].join("\n");

	fs.writeFileSync(ANIME_DATA_DEST, generated);
	console.log("[sync-content] anime: articles/anime -> blog/src/data/anime.ts");
}

function collectArticleChangeSummary() {
	if (!hasGitHead()) {
		return null;
	}

	const diffResult = runGitCommand([
		"diff",
		"--name-status",
		"--find-renames",
		"HEAD",
		"--",
		contentPathspec,
	]);
	if (!diffResult) {
		return null;
	}

	const untrackedResult = runGitCommand([
		"ls-files",
		"--others",
		"--exclude-standard",
		"--",
		contentPathspec,
	]);
	if (!untrackedResult) {
		return null;
	}

	const summary = {
		added: [],
		modified: [],
		deleted: [],
		renamed: [],
		draftToPublished: [],
		publishedToDraft: [],
	};
	const seenAdded = new Set();

	for (const rawLine of diffResult.stdout.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}

		const [status, firstPath = "", secondPath = ""] = line.split("\t");
		if (!status || !firstPath) {
			continue;
		}

		if (status.startsWith("R")) {
			const fromPath = formatArticlePath(firstPath);
			const toPath = formatArticlePath(secondPath);
			summary.renamed.push(`${fromPath} -> ${toPath}`);
			pushDraftTransition(summary, firstPath, secondPath, `${fromPath} -> ${toPath}`);
			continue;
		}

		const displayPath = formatArticlePath(firstPath);
		if (status.startsWith("A")) {
			pushAddedPath(summary, seenAdded, firstPath);
			continue;
		}

		if (status.startsWith("D")) {
			summary.deleted.push(displayPath);
			continue;
		}

		summary.modified.push(displayPath);
		pushDraftTransition(summary, firstPath, firstPath, displayPath);
	}

	for (const rawLine of untrackedResult.stdout.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}
		pushAddedPath(summary, seenAdded, line);
	}

	return summary;
}

function printArticleChangeSummary(summary) {
	if (!summary) {
		return;
	}

	const groups = [
		["新增", summary.added],
		["修改", summary.modified],
		["删除", summary.deleted],
		["改名", summary.renamed],
		["草稿 -> 已发布", summary.draftToPublished],
		["已发布 -> 草稿", summary.publishedToDraft],
	];
	const hasChanges = groups.some(([, items]) => items.length > 0);

	if (!hasChanges) {
		console.log("[sync-content] articles diff since HEAD: no source changes");
		return;
	}

	console.log("[sync-content] articles diff since HEAD:");
	for (const [label, items] of groups) {
		if (!items.length) {
			continue;
		}
		console.log(`  ${label} (${items.length}):`);
		for (const item of items) {
			console.log(`    - ${item}`);
		}
	}
}

function pushAddedPath(summary, seenAdded, repoRelativePath) {
	const displayPath = formatArticlePath(repoRelativePath);
	if (seenAdded.has(displayPath)) {
		return;
	}

	seenAdded.add(displayPath);
	summary.added.push(decorateAddedArticlePath(repoRelativePath, displayPath));
}

function decorateAddedArticlePath(repoRelativePath, displayPath) {
	if (!isPostSourceMarkdown(repoRelativePath)) {
		return displayPath;
	}

	const currentDraft = readDraftStateFromDisk(repoRelativePath);
	if (currentDraft === null) {
		return displayPath;
	}

	return `${displayPath}（${currentDraft ? "草稿" : "已发布"}）`;
}

function pushDraftTransition(summary, beforePath, afterPath, displayPath) {
	if (!isPostSourceMarkdown(beforePath) && !isPostSourceMarkdown(afterPath)) {
		return;
	}

	const beforeDraft = readDraftStateFromGit(beforePath);
	const afterDraft = readDraftStateFromDisk(afterPath);
	if (beforeDraft === null || afterDraft === null || beforeDraft === afterDraft) {
		return;
	}

	if (beforeDraft && !afterDraft) {
		summary.draftToPublished.push(displayPath);
		return;
	}

	if (!beforeDraft && afterDraft) {
		summary.publishedToDraft.push(displayPath);
	}
}

function readDraftStateFromDisk(repoRelativePath) {
	const filePath = path.join(repoRoot, normalizeRepoRelativePath(repoRelativePath));
	if (!fs.existsSync(filePath)) {
		return null;
	}
	return readDraftState(fs.readFileSync(filePath, "utf8"));
}

function readDraftStateFromGit(repoRelativePath) {
	const normalized = normalizeRepoRelativePath(repoRelativePath);
	const result = runGitCommand(["show", `HEAD:${normalized}`]);
	if (!result) {
		return null;
	}
	return readDraftState(result.stdout);
}

function readDraftState(content) {
	if (typeof content !== "string" || !content.length) {
		return null;
	}
	const frontmatter = parseFrontmatter(content);
	const draftValue = frontmatter.draft;
	if (draftValue === undefined || draftValue === null || draftValue === "") {
		return false;
	}
	if (typeof draftValue === "boolean") {
		return draftValue;
	}
	return String(draftValue).trim().toLowerCase() === "true";
}

function isPostSourceMarkdown(repoRelativePath) {
	const normalized = normalizeRepoRelativePath(repoRelativePath);
	return /^(?:articles\/)?(?:posts|essays)\/.+\.(md|mdx)$/i.test(normalized);
}

function formatArticlePath(repoRelativePath) {
	return normalizeRepoRelativePath(repoRelativePath).replace(/^articles\//, "");
}

function normalizeRepoRelativePath(repoRelativePath) {
	return String(repoRelativePath || "")
		.replaceAll("\\", "/")
		.replace(/^\.\/+/, "")
		.replace(/^\/+/, "")
		.trim();
}

function hasGitHead() {
	const result = spawnSync("git", ["-C", repoRoot, "rev-parse", "--verify", "HEAD"], {
		encoding: "utf8",
		windowsHide: true,
	});
	return result.status === 0;
}

function runGitCommand(args) {
	const result = spawnSync("git", ["-C", repoRoot, ...args], {
		encoding: "utf8",
		windowsHide: true,
		maxBuffer: 10 * 1024 * 1024,
	});
	return result.status === 0 ? result : null;
}

function parseFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return {};
	}
	const result = {};
	const lines = match[1].split(/\r?\n/);
	for (let index = 0; index < lines.length; index++) {
		const rawLine = lines[index];
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const colon = line.indexOf(":");
		if (colon < 0) {
			continue;
		}
		const key = line.slice(0, colon).trim();
		const rawValue = line.slice(colon + 1).trim();
		if (rawValue === "") {
			const objectList = parseIndentedObjectList(lines, index + 1);
			if (objectList.items.length) {
				result[key] = objectList.items;
				index = objectList.endIndex;
				continue;
			}

			const list = [];
			let cursor = index + 1;
			while (cursor < lines.length) {
				const listMatch = lines[cursor].match(/^\s*-\s+(.+?)\s*$/);
				if (!listMatch) {
					break;
				}
				list.push(parseFrontmatterValue(listMatch[1]));
				cursor++;
			}
			if (list.length) {
				result[key] = list;
				index = cursor - 1;
				continue;
			}
		}
		result[key] = parseFrontmatterValue(rawValue);
	}
	return result;
}

function parseIndentedObjectList(lines, startIndex) {
	const items = [];
	let cursor = startIndex;
	let current = null;

	while (cursor < lines.length) {
		const line = lines[cursor];
		if (!line.trim()) {
			cursor++;
			continue;
		}
		if (!/^\s+/.test(line)) {
			break;
		}

		const itemMatch = line.match(/^\s*-\s+([^:]+):\s*(.*?)\s*$/);
		if (itemMatch) {
			current = {};
			current[itemMatch[1].trim()] = parseFrontmatterValue(itemMatch[2]);
			items.push(current);
			cursor++;
			continue;
		}

		const propertyMatch = line.match(/^\s+([^:\s][^:]*):\s*(.*?)\s*$/);
		if (propertyMatch && current) {
			current[propertyMatch[1].trim()] = parseFrontmatterValue(propertyMatch[2]);
			cursor++;
			continue;
		}

		break;
	}

	return { items, endIndex: cursor - 1 };
}

function parseFrontmatterValue(value) {
	if (value === "") {
		return "";
	}
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
	if (/^-?\d+(\.\d+)?$/.test(value)) {
		return Number(value);
	}
	return value;
}

function normalizeAnimeItem(frontmatter, status, sourcePath) {
	const itemStatus = ["watching", "completed", "planned"].includes(frontmatter.status)
		? frontmatter.status
		: status;
	if (frontmatter.status && frontmatter.status !== itemStatus) {
		warnings.push(`${path.relative(repoRoot, sourcePath)}: status 不在 watching/completed/planned 中，已使用目录 ${status}`);
	}
	return {
		title: String(frontmatter.title ?? ""),
		status: itemStatus,
		rating: Number(frontmatter.rating) || 0,
		cover: String(frontmatter.cover ?? ""),
		description: String(frontmatter.description ?? ""),
		episodes: String(frontmatter.episodes ?? ""),
		year: String(frontmatter.year ?? ""),
		genre: Array.isArray(frontmatter.genre) ? frontmatter.genre.map(String) : [],
		studio: String(frontmatter.studio ?? ""),
		link: String(frontmatter.link ?? ""),
		progress: Number(frontmatter.progress) || 0,
		totalEpisodes: Number(frontmatter.totalEpisodes) || 0,
		startDate: String(frontmatter.startDate ?? ""),
		endDate: String(frontmatter.endDate ?? ""),
	};
}

function normalizeFriendItem(frontmatter, sourcePath, fallbackId) {
	if (frontmatter.visible === false || frontmatter.visible === "false") {
		return null;
	}

	const title = String(frontmatter.title ?? "").trim();
	const siteurl = String(frontmatter.siteurl ?? frontmatter.url ?? "").trim();

	if (!title) {
		warnings.push(`${path.relative(repoRoot, sourcePath)}: 友链缺少 title，已忽略`);
		return null;
	}

	if (!siteurl) {
		warnings.push(`${path.relative(repoRoot, sourcePath)}: 友链缺少 siteurl，已忽略`);
		return null;
	}

	return {
		id: Number(frontmatter.id) || fallbackId,
		title,
		imgurl: normalizeFriendImage(frontmatter.imgurl ?? frontmatter.avatar ?? ""),
		desc: String(frontmatter.desc ?? frontmatter.description ?? "").trim(),
		siteurl,
		screenshotUrl: buildFriendScreenshotUrl(siteurl),
		feedurl: normalizeFriendFeedUrl(
			frontmatter.feedurl ?? frontmatter.feed ?? frontmatter.rss ?? frontmatter.atom ?? "",
			siteurl,
		),
		tags: Array.isArray(frontmatter.tags)
			? frontmatter.tags.map(String).filter(Boolean)
			: [],
		posts: normalizeFriendPosts(frontmatter.posts),
	};
}

function normalizeFriendPosts(value) {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((item) => ({
			title: String(item?.title ?? "").trim(),
			url: String(item?.url ?? item?.link ?? "").trim(),
			excerpt: String(item?.excerpt ?? item?.description ?? "").trim(),
			date: String(item?.date ?? "").trim(),
		}))
		.filter((item) => item.title && item.url);
}

function buildFriendScreenshotUrl(siteurl) {
	const target = normalizeFriendScreenshotTarget(siteurl);
	if (!target) {
		return "";
	}
	return `/api/screenshot?url=${encodeURIComponent(target)}`;
}

function normalizeFriendScreenshotTarget(value) {
	try {
		const url = new URL(String(value || "").trim());
		if (!["http:", "https:"].includes(url.protocol)) {
			return "";
		}
		url.pathname = "/";
		url.search = "";
		url.hash = "";
		return url.toString();
	} catch {
		return "";
	}
}

function normalizeFriendImage(value) {
	const image = String(value || "").trim();
	if (!image) {
		return "";
	}
	if (
		image.startsWith("http://") ||
		image.startsWith("https://") ||
		image.startsWith("/")
	) {
		return image;
	}
	return toPublicAssetPath("friends", image);
}

function normalizeFriendFeedUrl(value, siteurl) {
	const feed = String(value || "").trim();
	if (!feed) {
		return "";
	}
	try {
		const url = new URL(feed, siteurl);
		if (!["http:", "https:"].includes(url.protocol)) {
			return "";
		}
		url.hash = "";
		return url.toString();
	} catch {
		return "";
	}
}

function readJson(filename, fallback) {
	const filePath = path.join(SITE_CONFIG_SRC, filename);
	if (!fs.existsSync(filePath)) {
		return fallback;
	}
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		warnings.push(`${path.relative(repoRoot, filePath)}: JSON 解析失败：${error.message}`);
		return fallback;
	}
}

function normalizeProfileConfig(profile) {
	if (!profile || typeof profile !== "object") {
		return {};
	}
	const result = pick(profile, ["name", "bio", "links", "typewriter"]);
	if (typeof profile.avatar === "string" && profile.avatar.trim()) {
		result.avatar = toPublicAssetPath("profile", profile.avatar);
	}
	return result;
}

function normalizeNavBarConfig(navigation) {
	if (!navigation || typeof navigation !== "object") {
		return {};
	}
	const links = normalizeNavLinks(navigation.links);
	return links.length ? { links } : {};
}

function normalizeNavLinks(links) {
	if (!Array.isArray(links)) {
		return [];
	}
	return links
		.map(normalizeNavLink)
		.filter((link) => link !== null);
}

function normalizeNavLink(link) {
	if (!link || typeof link !== "object" || link.visible === false) {
		return null;
	}
	if (typeof link.preset === "string") {
		const preset = normalizeLinkPreset(link.preset);
		if (preset !== null) {
			return preset;
		}
		warnings.push(`articles/site/navigation.json: 未知 preset，已忽略：${link.preset}`);
		return null;
	}
	if (typeof link.url !== "string" || !link.url.trim()) {
		warnings.push("articles/site/navigation.json: 缺少 url 的导航项已忽略");
		return null;
	}
	const result = pick(link, ["name", "url", "external", "icon"]);
	if (!result.name) {
		result.name = result.url;
	}
	const children = normalizeNavLinks(link.children);
	if (children.length) {
		result.children = children;
	}
	return result;
}

function normalizeLinkPreset(value) {
	const presetMap = {
		Home: "LinkPreset.Home",
		Archive: "LinkPreset.Archive",
		About: "LinkPreset.About",
		Friends: "LinkPreset.Friends",
		Anime: "LinkPreset.Anime",
		Diary: "LinkPreset.Diary",
		Albums: "LinkPreset.Albums",
		Projects: "LinkPreset.Projects",
		Skills: "LinkPreset.Skills",
		Timeline: "LinkPreset.Timeline",
	};
	return presetMap[value] ?? null;
}

function normalizeBannerConfig(banner) {
	if (!banner || typeof banner !== "object") {
		return {};
	}
	const desktop = normalizeAssetList(banner.desktop, "desktop-banner", "desktop");
	const mobile = normalizeAssetList(banner.mobile, "mobile-banner", "mobile");
	const result = {};
	if (desktop.length || mobile.length) {
		result.src = {};
		if (desktop.length) {
			result.src.desktop = desktop;
		}
		if (mobile.length) {
			result.src.mobile = mobile;
		}
	}
	const position = normalizePosition(banner.position);
	if (position) {
		result.position = position;
	}
	result.carousel = {
		enable: banner.carousel?.enable ?? banner.enableCarousel ?? true,
		interval: banner.carousel?.interval ?? banner.interval ?? 3,
	};
	if (banner.homeText) {
		result.homeText = banner.homeText;
	}
	if (banner.credit) {
		result.credit = banner.credit;
	}
	return result;
}

function normalizeFullscreenWallpaperConfig(banner) {
	const normalized = normalizeBannerConfig(banner);
	const result = {};
	if (normalized.src) {
		result.src = normalized.src;
	}
	if (normalized.position) {
		result.position = normalized.position;
	}
	if (normalized.carousel) {
		result.carousel = normalized.carousel;
	}
	return result;
}

function normalizeAnnouncementConfig(announcement) {
	if (!announcement || typeof announcement !== "object") {
		return {};
	}
	return pick(announcement, [
		"id",
		"updated",
		"title",
		"content",
		"icon",
		"type",
		"closable",
		"links",
	]);
}

function normalizeSponsorConfig(sponsor) {
	if (!sponsor || typeof sponsor !== "object") {
		return {};
	}

	const supporters = Array.isArray(sponsor.supporters)
		? sponsor.supporters
			.map((supporter) => ({
				name: String(supporter?.name ?? "").trim(),
				source: String(supporter?.source ?? "").trim(),
			}))
			.filter((supporter) => supporter.name)
		: [];

	return { supporters };
}

function normalizeMusicPlayerConfig(music) {
	if (!music || typeof music !== "object") {
		return {};
	}
	return {
		enable: music.enable ?? true,
		showFloatingPlayer: music.showFloatingPlayer ?? true,
		floatingEntryMode: music.floatingEntryMode ?? "fab",
		mode: "local",
	};
}

function normalizeMusicSettings(music) {
	return {
		regionAware: music?.regionAware ?? true,
		shuffle: music?.shuffle ?? true,
		defaultProvider: normalizeMusicProvider(music?.defaultProvider),
	};
}

function normalizeMusicTracks(music) {
	if (!music || !Array.isArray(music.tracks)) {
		return [];
	}
	return music.tracks.map((track, index) => ({
		id: Number.isFinite(track.id) ? track.id : index + 1,
		title: String(track.title ?? `Track ${index + 1}`),
		artist: String(track.artist ?? "Unknown Artist"),
		cover: track.cover ? toPublicAssetPath("music", track.cover) : "",
		url: track.url ? toPublicAssetPath("music", track.url) : "",
		duration: Number.isFinite(track.duration) ? track.duration : 0,
		category: track.category ?? "",
		youtube: track.youtube ?? "",
		netease: track.netease ?? "",
	}));
}

function normalizeAssetList(value, publicFolder, sourcePrefix = "") {
	const list = Array.isArray(value) ? value : value ? [value] : [];
	return list
		.filter((item) => typeof item === "string" && item.trim())
		.map((item) => toPublicAssetPath(publicFolder, stripSourcePrefix(item, sourcePrefix)));
}

function toPublicAssetPath(publicFolder, value) {
	const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
	if (normalized.startsWith("assets/")) {
		return `/${normalized}`;
	}
	if (normalized === publicFolder || normalized.startsWith(`${publicFolder}/`)) {
		return `/assets/${normalized}`;
	}
	return `/assets/${publicFolder}/${normalized}`;
}

function stripSourcePrefix(value, prefix) {
	const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
	if (!prefix) {
		return normalized;
	}
	return normalized.startsWith(`${prefix}/`)
		? normalized.slice(prefix.length + 1)
		: normalized;
}

function pick(source, keys) {
	const result = {};
	for (const key of keys) {
		if (source[key] !== undefined) {
			result[key] = source[key];
		}
	}
	return result;
}

function normalizePosition(value) {
	if (["top", "center", "bottom"].includes(value)) {
		return value;
	}
	if (value !== undefined) {
		warnings.push(`articles/site/banner.json: position 只能是 top、center、bottom，已忽略：${value}`);
	}
	return undefined;
}

function normalizeMusicProvider(value) {
	if (["auto", "netease", "youtube"].includes(value)) {
		return value;
	}
	if (value !== undefined) {
		warnings.push(`articles/site/music.json: defaultProvider 只能是 auto、netease、youtube，已回退 auto：${value}`);
	}
	return "auto";
}

function toTsObject(value) {
	return JSON.stringify(value, null, "\t")
		.replace(/"LinkPreset\.([A-Za-z]+)"/g, "LinkPreset.$1")
		.replace(/\n/g, "\n");
}

function buildContentIndex(sources) {
	const index = new Map();

	for (const source of sources) {
		addContentIndexEntries(index, source);
	}

	applyPublicWikiAliases(index);
	return index;
}

function addContentIndexEntries(index, source) {
	if (!fs.existsSync(source.dir)) {
		return;
	}

	for (const filePath of walk(source.dir)) {
		if (!/\.(md|mdx)$/i.test(filePath)) {
			continue;
		}

		const relative = path.relative(source.dir, filePath).replaceAll("\\", "/");
		const parsed = path.parse(relative);
		const slug = toPostSlug(relative);
		const content = fs.readFileSync(filePath, "utf8");
		const title = readFrontmatterTitle(content);
		const url =
			source.urlPrefix.endsWith("#")
				? `${source.urlPrefix}${slug}`
				: `${source.urlPrefix}${slug}/`;

		for (const key of [
			parsed.name,
			path.dirname(relative) === "." ? "" : path.basename(path.dirname(relative)),
			relative.replace(/\.(md|mdx)$/i, ""),
			title,
			...deriveTitleLookupAliases(title),
		]) {
			if (key) {
				addPostIndexKey(index, key, { slug, url });
			}
		}
	}
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

	// folder-per-post: posts/foo/foo.md → slug "foo" (not "foo/foo")
	if (segments.length >= 2) {
		const last = segments[segments.length - 1].toLowerCase();
		const parent = segments[segments.length - 2].toLowerCase();
		if (last === parent) {
			segments.pop();
		}
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

function normalizeLookupKey(value) {
	return value
		.replace(/\.(md|mdx)$/i, "")
		.replaceAll("\\", "/")
		.toLowerCase()
		.trim();
}

function addPostIndexKey(index, key, entry) {
	for (const candidate of [key, slugify(key)]) {
		const normalized = normalizeLookupKey(candidate);
		if (normalized && !index.has(normalized)) {
			index.set(normalized, entry);
		}
	}
}

function deriveTitleLookupAliases(title) {
	if (!title) {
		return [];
	}

	const aliases = new Set();
	const compact = title.replace(/\s+/g, "");
	const simplified = compact
		.replace(/^(最近的|近期的|当前的|我的|一份|关于)/, "")
		.replace(/(公开版|整理版)$/, "");

	for (const candidate of [simplified, simplified.replace(/^公开/, "")]) {
		if (candidate && candidate !== compact) {
			aliases.add(candidate);
		}
	}

	return Array.from(aliases);
}

function applyPublicWikiAliases(index) {
	for (const [alias, slug] of PUBLIC_WIKI_ALIASES) {
		const entry = findContentIndexEntryBySlug(index, slug);
		if (!entry) {
			continue;
		}
		addPostIndexKey(index, alias, entry);
	}
}

function findContentIndexEntryBySlug(index, slug) {
	for (const value of index.values()) {
		if (value.slug === slug) {
			return value;
		}
	}
	return null;
}

function isPrivateWikiTarget(value) {
	return PRIVATE_WIKI_TARGETS.has(value.trim());
}

function readFrontmatterTitle(content) {
	const frontmatter = parseFrontmatter(content);
	return frontmatter.title ? String(frontmatter.title).trim() : "";
}
