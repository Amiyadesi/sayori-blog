import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

const distDir = path.resolve("dist");
const sourcePostsDir = path.resolve("src/content/posts");
const sourceEssaysDir = path.resolve("src/content/essays");
const constantsFile = path.resolve("src/constants/constants.ts");
const sourceHeadersFile = path.resolve("public/_headers");
const requiredFiles = [
	"index.html",
	"robots.txt",
	"sitemap.xml",
	"sitemap-index.xml",
	"sitemap-0.xml",
	"rss.xml",
	"atom.xml",
	"llms.txt",
	"archive/index.html",
	"admin/growth/index.html",
	"essays/index.html",
	"sponsor/index.html",
	"topics/webmaster/index.html",
	"pagefind/pagefind.js",
];

let failed = false;

function fail(message) {
	failed = true;
	console.error(`✗ ${message}`);
}

function pass(message) {
	console.log(`✓ ${message}`);
}

function readDistFile(relativePath) {
	const fullPath = path.join(distDir, relativePath);
	if (!fs.existsSync(fullPath)) {
		fail(`Missing dist/${relativePath}`);
		return "";
	}

	const stat = fs.statSync(fullPath);
	if (!stat.isFile() || stat.size === 0) {
		fail(`dist/${relativePath} is empty or not a file`);
		return "";
	}

	pass(`dist/${relativePath} exists (${stat.size} bytes)`);
	return fs.readFileSync(fullPath, "utf8");
}

function readTextIfExists(filePath) {
	if (!fs.existsSync(filePath)) {
		return "";
	}
	return fs.readFileSync(filePath, "utf8");
}

function readLinkedAstroModules(html) {
	const root = parse(html);
	return root
		.querySelectorAll('script[type="module"][src]')
		.map((script) => script.getAttribute("src") || "")
		.filter((src) => src.startsWith("/_astro/") && !src.includes(".."))
		.map((src) => readTextIfExists(path.join(distDir, src.slice(1))))
		.join("\n");
}

function walkDistTextFiles(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return walkDistTextFiles(fullPath);
		return entry.isFile() && /\.(?:css|html)$/i.test(entry.name) ? [fullPath] : [];
	});
}

function verifyLocalFontReferences() {
	const stale = [];
	for (const filePath of walkDistTextFiles(distDir)) {
		const content = fs.readFileSync(filePath, "utf8");
		if (/url\([^)]*\/assets\/font\/[^)]*\.ttf(?:[?#][^)]*)?\)/i.test(content)) {
			stale.push(path.relative(distDir, filePath).replaceAll(path.sep, "/"));
		}
	}
	if (stale.length > 0) {
		fail(`Local TTF references remain in ${stale.slice(0, 8).join(", ")}`);
	} else {
		pass("Built HTML and CSS use compressed local fonts");
	}
}

function verifyBlogMediaOutput() {
	const baseUrl = String(process.env.BLOG_MEDIA_BASE_URL || "")
		.trim()
		.replace(/\/+$/, "");
	if (!baseUrl) {
		pass("Blog media output remains in local development mode");
		return;
	}

	const manifestPath = path.resolve(
		String(
			process.env.BLOG_MEDIA_MANIFEST ||
				path.join(".cache", "blog-media", "manifest.json"),
		),
	);
	if (!fs.existsSync(manifestPath)) {
		fail(`Blog media manifest is missing: ${manifestPath}`);
		return;
	}
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	if (String(manifest.baseUrl || "").replace(/\/+$/, "") !== baseUrl) {
		fail("Blog media manifest base URL does not match BLOG_MEDIA_BASE_URL");
		return;
	}

	const postImageDir = path.join(distDir, "images", "posts");
	const copiedPostImages = fs.existsSync(postImageDir)
		? walkAllFiles(postImageDir).filter(
				(filePath) => path.basename(filePath) !== ".gitkeep",
			)
		: [];
	if (copiedPostImages.length > 0) {
		fail(
			`Production output still contains ${copiedPostImages.length} post image copies`,
		);
	} else {
		pass("Production output contains no post image copies");
	}

	const remoteByPost = new Map();
	for (const asset of manifest.assets || []) {
		if (asset.source?.kind !== "remote" || !asset.source.post) continue;
		const entries = remoteByPost.get(asset.source.post) || [];
		entries.push(asset);
		remoteByPost.set(asset.source.post, entries);
	}

	for (const [post, assets] of remoteByPost) {
		const relativePath = path.join("posts", post, "index.html");
		const html = readDistFile(relativePath);
		requireExcludes(`dist/${relativePath}`, html, ["cdn3.ldstatic.com"]);
		const root = parse(html);
		verifyLocalizedRepost(post, root, relativePath);
		const images = root
			.querySelectorAll("img[src]")
			.filter((image) =>
				String(image.getAttribute("src") || "").startsWith(
					`${baseUrl}/`,
				),
			);
		if (images.length !== assets.length) {
			fail(
				`dist/${relativePath} has ${images.length} CDN images, expected ${assets.length}`,
			);
		}

		for (const asset of assets) {
			const image = images.find(
				(node) => node.getAttribute("src") === asset.primaryUrl,
			);
			if (!image) {
				fail(
					`dist/${relativePath} missing CDN image ${asset.primaryUrl}`,
				);
				continue;
			}
			for (const [attribute, expected] of [
				["loading", "lazy"],
				["decoding", "async"],
				["width", String(asset.width)],
				["height", String(asset.height)],
			]) {
				if (image.getAttribute(attribute) !== expected) {
					fail(
						`dist/${relativePath} image ${asset.hash} has invalid ${attribute}`,
					);
				}
			}
			if ((asset.variants || []).length > 1) {
				const srcset = image.getAttribute("srcset") || "";
				for (const variant of asset.variants) {
					if (!srcset.includes(`${variant.url} ${variant.width}w`)) {
						fail(
							`dist/${relativePath} image ${asset.hash} is missing a srcset variant`,
						);
					}
				}
			}
		}
		pass(
			`dist/${relativePath} maps ${assets.length} authorized images to the CDN`,
		);
	}
}

function verifyLocalizedRepost(post, root, relativePath) {
	const expectations = {
		"cross-app-tracking-device-fingerprinting": {
			sourceUrl: "https://linux.do/t/topic/2598156",
			localLinks: [
				"/posts/rogue-app-advertising-user-traps/",
				"/posts/mobile-app-ad-targeting-device-profiling/",
			],
			forbiddenLinks: [
				"https://linux.do/t/topic/2161543",
				"https://linux.do/t/topic/2502409",
			],
		},
		"mobile-app-ad-targeting-device-profiling": {
			sourceUrl: "https://linux.do/t/topic/2502409",
			localLinks: ["/posts/rogue-app-advertising-user-traps/"],
			forbiddenLinks: ["https://linux.do/t/topic/2161543?u=aichitangcupaigu"],
		},
		"rogue-app-advertising-user-traps": {
			sourceUrl: "https://linux.do/t/topic/2161543",
			localLinks: [],
			forbiddenLinks: [],
		},
	};
	const expected = expectations[post];
	if (!expected) return;

	const label = `dist/${relativePath}`;
	const title = root.querySelector("title")?.textContent || "";
	if (!title.startsWith("（转载）")) {
		fail(`${label} title is missing the repost prefix`);
	}

	const details = root.querySelector("details.repost-source");
	if (!details || details.hasAttribute("open")) {
		fail(`${label} repost source must use a closed details element`);
		return;
	}
	if (details.querySelector("summary")?.textContent.trim() !== "原文与授权") {
		fail(`${label} repost source summary is missing`);
	}
	if (!details.textContent.includes("已获得原作者授权")) {
		fail(`${label} repost authorization text is missing`);
	}
	const sourceLinks = root.querySelectorAll(`a[href="${expected.sourceUrl}"]`);
	if (sourceLinks.length !== 1 || !details.querySelector(`a[href="${expected.sourceUrl}"]`)) {
		fail(`${label} must expose the original URL only inside the source details`);
	}
	for (const href of expected.localLinks) {
		if (!root.querySelector(`a[href="${href}"]`)) {
			fail(`${label} is missing localized article link ${href}`);
		}
	}
	for (const href of expected.forbiddenLinks) {
		if (root.querySelector(`a[href="${href}"]`)) {
			fail(`${label} still links a localized article back to ${href}`);
		}
	}
	pass(`${label} keeps repost attribution collapsed and localizes article links`);
}

function walkAllFiles(directory) {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const filePath = path.join(directory, entry.name);
			if (entry.isDirectory()) return walkAllFiles(filePath);
			return entry.isFile() ? [filePath] : [];
		});
}

function verifyCssDelivery(html) {
	const root = parse(html);
	const inlineCssBytes = root
		.querySelectorAll("style")
		.reduce((total, style) => total + Buffer.byteLength(style.innerHTML, "utf8"), 0);
	const linkedStylesheets = root.querySelectorAll('link[rel="stylesheet"]').length;
	if (inlineCssBytes > 128 * 1024) {
		fail(`index.html inlines ${inlineCssBytes} CSS bytes; expected at most 131072`);
	} else {
		pass(`index.html inline CSS is bounded (${inlineCssBytes} bytes)`);
	}
	if (linkedStylesheets === 0) {
		fail("index.html must keep non-critical CSS in external stylesheets");
	} else {
		pass(`index.html links ${linkedStylesheets} external stylesheet(s)`);
	}
}

function requireIncludes(name, content, snippets) {
	for (const snippet of snippets) {
		if (!content.includes(snippet)) {
			fail(`${name} missing ${snippet}`);
		} else {
			pass(`${name} contains ${snippet}`);
		}
	}
}

function requireExcludes(name, content, snippets) {
	for (const snippet of snippets) {
		if (content.includes(snippet)) {
			fail(`${name} should not contain ${snippet}`);
		} else {
			pass(`${name} excludes ${snippet}`);
		}
	}
}

function normalizeType(value) {
	if (Array.isArray(value)) {
		return value.flatMap(normalizeType);
	}
	if (typeof value === "string") {
		return [value];
	}
	return [];
}

function nodeHasType(node, typeName) {
	return normalizeType(node?.["@type"]).includes(typeName);
}

function flattenJsonLd(value) {
	if (Array.isArray(value)) {
		return value.flatMap(flattenJsonLd);
	}
	if (!value || typeof value !== "object") {
		return [];
	}

	const nodes = [value];
	if (Array.isArray(value["@graph"])) {
		nodes.push(...value["@graph"].flatMap(flattenJsonLd));
	}
	return nodes;
}

function getJsonLdNodes(html, name) {
	const root = parse(html);
	const scripts = root
		.querySelectorAll('script[type="application/ld+json"]')
		.map((script) => script.text.trim())
		.filter(Boolean);

	if (scripts.length === 0) {
		fail(`${name} missing JSON-LD scripts`);
		return [];
	}

	const nodes = [];
	scripts.forEach((script, index) => {
		try {
			nodes.push(...flattenJsonLd(JSON.parse(script)));
			pass(`${name} JSON-LD script ${index + 1} parses`);
		} catch (error) {
			fail(
				`${name} JSON-LD script ${index + 1} is invalid: ${error.message}`,
			);
		}
	});
	return nodes;
}

function requireJsonLdTypes(name, nodes, typeNames) {
	for (const typeName of typeNames) {
		if (nodes.some((node) => nodeHasType(node, typeName))) {
			pass(`${name} JSON-LD includes ${typeName}`);
		} else {
			fail(`${name} JSON-LD missing ${typeName}`);
		}
	}
}

function requireNoJsonLdType(name, nodes, typeName) {
	const matches = nodes.filter((node) => nodeHasType(node, typeName));
	if (matches.length > 0) {
		fail(`${name} JSON-LD must not include ${typeName}`);
	} else {
		pass(`${name} JSON-LD has no ${typeName} schema`);
	}
}

function requireDocumentTitle(name, html, expectedTitle) {
	const root = parse(html);
	const title = root.querySelector("title")?.text.trim() || "";
	if (title === expectedTitle) {
		pass(`${name} title matches expected homepage title`);
	} else {
		fail(`${name} title expected "${expectedTitle}", got "${title}"`);
	}
}

function verifyVisibleFaqMatchesJsonLd(name, html, nodes) {
	const faqPage = nodes.find((node) => nodeHasType(node, "FAQPage"));
	if (!faqPage) {
		fail(`${name} missing FAQPage for visible FAQ check`);
		return;
	}

	const root = parse(html);
	const visibleText = root.text.replace(/\s+/g, " ");
	const questions = Array.isArray(faqPage.mainEntity)
		? faqPage.mainEntity
		: [];

	if (questions.length === 0) {
		fail(`${name} FAQPage has no mainEntity questions`);
		return;
	}

	for (const item of questions) {
		const question = String(item?.name || "").trim();
		const answer = String(item?.acceptedAnswer?.text || "").trim();
		if (!question || !answer) {
			fail(`${name} FAQPage contains an incomplete question/answer`);
			continue;
		}
		if (visibleText.includes(question) && visibleText.includes(answer)) {
			pass(`${name} visible FAQ matches JSON-LD question: ${question}`);
		} else {
			fail(`${name} visible FAQ missing JSON-LD text for: ${question}`);
		}
	}
}

function requireAnyHref(name, html, expectedPath) {
	const root = parse(html);
	const matches = root
		.querySelectorAll("a[href]")
		.map((link) => normalizeInternalHref(link.getAttribute("href")))
		.filter((href) => href === expectedPath);

	if (matches.length > 0) {
		pass(`${name} links to ${expectedPath}`);
	} else {
		fail(`${name} missing link to ${expectedPath}`);
	}
}

function verifyAnalyticsScripts(html) {
	requireIncludes("index.html", html, ["/api/analytics/event"]);

	const root = parse(html);
	const googleAnalyticsScripts = root
		.querySelectorAll("script")
		.filter((script) => {
			const body = script.innerHTML;
			return (
				body.includes("googleAnalyticsEnable") ||
				body.includes("googleAnalyticsId")
			);
		});

	for (const script of googleAnalyticsScripts) {
		const body = script.innerHTML;
		const hasEnableBinding =
			!body.includes("googleAnalyticsEnable") ||
			/\b(?:const|let|var)\s+googleAnalyticsEnable\b/.test(body);
		const hasIdBinding =
			!body.includes("googleAnalyticsId") ||
			/\b(?:const|let|var)\s+googleAnalyticsId\b/.test(body);
		if (hasEnableBinding && hasIdBinding) {
			pass("index.html analytics script has local Google Analytics bindings");
		} else {
			fail("index.html analytics script references an undefined Google Analytics binding");
		}
	}

	const umamiScripts = root
		.querySelectorAll("script")
		.filter((script) => {
			const src = script.getAttribute("src") || "";
			return (
				src.includes("stats.sayori.org") ||
				script.hasAttribute("data-website-id")
			);
		});

	if (umamiScripts.length === 0) {
		pass("index.html has no Umami script until a real websiteId is configured");
		return;
	}

	for (const script of umamiScripts) {
		const websiteId = script.getAttribute("data-website-id") || "";
		if (
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				websiteId,
			)
		) {
			pass("index.html Umami script has a valid websiteId");
		} else {
			fail("index.html Umami script is present without a valid websiteId");
		}
	}
}

function verifyHomepageCriticalMedia(html) {
	const root = parse(html);
	const fullscreenWallpaper = root.querySelector("[data-fullscreen-wallpaper]");
	if (!fullscreenWallpaper) {
		fail("index.html missing fullscreen wallpaper container");
	} else if (fullscreenWallpaper.querySelectorAll("img").length > 0) {
		fail("index.html fullscreen wallpaper must not render images before fullscreen mode is selected");
	} else {
		pass("index.html fullscreen wallpaper defers images until fullscreen mode is selected");
	}

	const eagerBannerImages = root
		.querySelectorAll("#banner-carousel img[loading='eager']")
		.filter((image) => (image.getAttribute("src") || "").includes("-banner/"));
	if (eagerBannerImages.length === 1) {
		pass("index.html has one eager banner image for the active viewport");
	} else {
		fail(`index.html expected one eager banner image, found ${eagerBannerImages.length}`);
	}

	const mobileBannerSource = root.querySelector(
		'picture source[media="(max-width: 767px)"]',
	);
	if (
		mobileBannerSource?.getAttribute("srcset") ===
		"/assets/mobile-banner/1-640.webp 640w, /assets/mobile-banner/1-1080.webp 1080w"
	) {
		pass("index.html uses the responsive mobile LCP banner source set");
	} else {
		fail("index.html missing the responsive mobile LCP banner source set");
	}

	const mobileBannerPreload = root.querySelector(
		'link[rel="preload"][as="image"][media="(max-width: 767px)"]',
	);
	if (
		mobileBannerPreload?.getAttribute("href") ===
			"/assets/mobile-banner/1-1080.webp" &&
		mobileBannerPreload.getAttribute("imagesrcset") ===
			"/assets/mobile-banner/1-640.webp 640w, /assets/mobile-banner/1-1080.webp 1080w"
	) {
		pass("index.html preloads the responsive mobile LCP banner");
	} else {
		fail("index.html missing the responsive mobile LCP banner preload");
	}

	for (const assetPath of [
		"assets/mobile-banner/1-640.webp",
		"assets/mobile-banner/1-1080.webp",
	]) {
		const fullPath = path.join(distDir, assetPath);
		if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
			pass(`dist/${assetPath} exists for the mobile LCP banner`);
		} else {
			fail(`Missing dist/${assetPath} for the mobile LCP banner`);
		}
	}
}

function requireNoHref(name, html, forbiddenPath) {
	const root = parse(html);
	const matches = root
		.querySelectorAll("a[href]")
		.map((link) => normalizeInternalHref(link.getAttribute("href")))
		.filter((href) => href === forbiddenPath);

	if (matches.length === 0) {
		pass(`${name} does not link draft path ${forbiddenPath}`);
	} else {
		fail(`${name} must not link draft path ${forbiddenPath}`);
	}
}

function verifySourceSecurityHeaders() {
	const headers = readTextIfExists(sourceHeadersFile);
	if (!headers) {
		fail("Missing blog/public/_headers");
		return;
	}

	requireIncludes("blog/public/_headers", headers, [
		"X-Frame-Options: SAMEORIGIN",
		"X-Content-Type-Options: nosniff",
		"Referrer-Policy: strict-origin-when-cross-origin",
		"Permissions-Policy: camera=(), microphone=(), geolocation=()",
	]);
}

function getPageSize() {
	const constants = readTextIfExists(constantsFile);
	const match = constants.match(/\bPAGE_SIZE\s*=\s*(\d+)/);
	if (!match) {
		fail("Could not read PAGE_SIZE from src/constants/constants.ts");
		return 8;
	}
	return Number.parseInt(match[1], 10);
}

function walkMarkdownFiles(dir) {
	if (!fs.existsSync(dir)) {
		fail(`Missing source posts directory: ${dir}`);
		return [];
	}

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return walkMarkdownFiles(fullPath);
		}
		if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
			return [fullPath];
		}
		return [];
	});
}

function getContentId(filePath, baseDir = sourcePostsDir) {
	const relativePath = path
		.relative(baseDir, filePath)
		.replace(/\\/g, "/")
		.replace(/\.(md|mdx)$/i, "");

	const sourceId = relativePath.endsWith("/index")
		? relativePath.slice(0, -"/index".length)
		: relativePath;
	const segments = sourceId.split("/").filter(Boolean);
	return segments.map(slugify).join("/");
}

function getPostId(filePath) {
	return getContentId(filePath, sourcePostsDir);
}

function getEssayId(filePath) {
	return getContentId(filePath, sourceEssaysDir);
}

function parseFrontmatter(filePath) {
	const content = fs.readFileSync(filePath, "utf8");
	const match = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return {};
	}

	const data = {};
	for (const line of match[1].split(/\r?\n/)) {
		const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
		if (!field) {
			continue;
		}

		const key = field[1];
		let value = field[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (value === "true") {
			data[key] = true;
			continue;
		}
		if (value === "false") {
			data[key] = false;
			continue;
		}
		data[key] = value;
	}
	return data;
}

function parseDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return date;
}

function parseDateField(post, fieldName, options = {}) {
	const value = post.data[fieldName];
	if (value === undefined || value === "") {
		if (options.required) {
			fail(`${post.id} has a missing ${fieldName} date`);
		}
		return null;
	}

	const date = parseDate(value);
	if (!date) {
		fail(`${post.id} has an invalid ${fieldName} date`);
		return null;
	}
	return date;
}

function getPostActivityDate(post) {
	return (
		parseDateField(post, "lastEdited") ??
		parseDateField(post, "updated") ??
		parseDateField(post, "created") ??
		parseDateField(post, "published", { required: true }) ??
		new Date(0)
	);
}

function getPostPublishedDate(post) {
	return parseDateField(post, "published", { required: true }) ?? new Date(0);
}

function getPostPriority(post) {
	if (post.data.priority === undefined || post.data.priority === "") {
		return undefined;
	}

	const priority = Number(post.data.priority);
	if (!Number.isFinite(priority)) {
		fail(`${post.id} has an invalid priority value`);
		return undefined;
	}
	return priority;
}

function comparePostsByLatestUpdate(a, b) {
	if (a.data.pinned && !b.data.pinned) {
		return -1;
	}
	if (!a.data.pinned && b.data.pinned) {
		return 1;
	}

	if (a.data.pinned && b.data.pinned) {
		const priorityA = getPostPriority(a);
		const priorityB = getPostPriority(b);
		if (priorityA !== undefined && priorityB !== undefined) {
			if (priorityA !== priorityB) {
				return priorityA - priorityB;
			}
		} else if (priorityA !== undefined) {
			return -1;
		} else if (priorityB !== undefined) {
			return 1;
		}
	}

	const activityDiff =
		getPostActivityDate(b).getTime() - getPostActivityDate(a).getTime();
	if (activityDiff !== 0) {
		return activityDiff;
	}

	const publishedDiff =
		getPostPublishedDate(b).getTime() - getPostPublishedDate(a).getTime();
	if (publishedDiff !== 0) {
		return publishedDiff;
	}

	return a.id.localeCompare(b.id);
}

function trimUrlPath(value) {
	return String(value).replace(/^\/+/, "").replace(/\/+$/, "");
}

function slugify(value) {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

function getPostUrl(post) {
	if (post.data.permalink) {
		return `/${trimUrlPath(post.data.permalink)}/`;
	}
	if (post.data.alias) {
		return `/posts/${trimUrlPath(post.data.alias)}/`;
	}
	return `/posts/${post.id}/`;
}

function getEssayUrl(post) {
	return `/essays/#${post.id}`;
}

function isDiaryPost(post) {
	return (
		post.id.startsWith("diary/") || post.data.title?.startsWith("日记：")
	);
}

function isEssayPost(post) {
	return post.data.draft !== true && post.data.essay === true;
}

function getExpectedHomePostUrls() {
	return walkMarkdownFiles(sourcePostsDir)
		.map((filePath) => ({
			id: getPostId(filePath),
			data: parseFrontmatter(filePath),
		}))
		.filter((post) => post.data.draft !== true)
		.filter((post) => !isDiaryPost(post))
		.filter((post) => !isEssayPost(post))
		.filter((post) => post.data.hideHomeContent !== true)
		.map((post) => ({
			...post,
			url: getPostUrl(post),
		}))
		.sort(comparePostsByLatestUpdate)
		.map((post) => post.url);
}

function getExpectedArchivePosts() {
	return walkMarkdownFiles(sourcePostsDir)
		.map((filePath) => ({
			id: getPostId(filePath),
			data: parseFrontmatter(filePath),
		}))
		.filter((post) => post.data.draft !== true)
		.filter((post) => !isDiaryPost(post))
		.filter((post) => !isEssayPost(post))
		.map((post) => ({
			...post,
			url: getPostUrl(post),
		}))
		.sort(comparePostsByLatestUpdate);
}

function escapeHtmlAttribute(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function normalizeInternalHref(rawHref) {
	if (!rawHref) {
		return "";
	}

	try {
		const parsed = rawHref.startsWith("http")
			? new URL(rawHref)
			: new URL(rawHref, "https://blog.sayori.org");
		if (parsed.origin !== "https://blog.sayori.org") {
			return "";
		}
		return parsed.pathname;
	} catch {
		return "";
	}
}

function extractHomePostUrls(html, name) {
	const root = parse(html);
	const container = root.querySelector("#post-list-container");
	if (!container) {
		fail(`${name} missing #post-list-container`);
		return [];
	}

	const urls = [];
	const seen = new Set();
	for (const link of container.querySelectorAll("a[href]")) {
		const href = normalizeInternalHref(link.getAttribute("href"));
		if (
			!href ||
			href.startsWith("/archive/") ||
			href === "/" ||
			seen.has(href)
		) {
			continue;
		}
		seen.add(href);
		urls.push(href);
	}
	return urls;
}

function requireSameList(
	name,
	actual,
	expected,
	orderLabel = "expected order",
) {
	if (actual.length !== expected.length) {
		fail(
			`${name} expected ${expected.length} post cards, got ${actual.length}`,
		);
		return;
	}

	for (let index = 0; index < expected.length; index += 1) {
		if (actual[index] !== expected[index]) {
			fail(
				`${name} post ${index + 1} expected ${expected[index]}, got ${actual[index]}`,
			);
			return;
		}
	}

	pass(`${name} post cards match ${orderLabel}`);
}

function getExpectedDefaultImageUrl() {
	return "https://blog.sayori.org/assets/desktop-banner/1.webp";
}

function findFirstPublicPostWithoutImage() {
	return walkMarkdownFiles(sourcePostsDir)
		.map((filePath) => ({
			id: getPostId(filePath),
			data: parseFrontmatter(filePath),
		}))
		.find(
			(post) =>
				post.data.draft !== true &&
				!isDiaryPost(post) &&
				!isEssayPost(post) &&
				!String(post.data.image || "").trim(),
		);
}

function verifyPostDefaultImageMetadata() {
	const post = findFirstPublicPostWithoutImage();
	if (!post) {
		pass(
			"No public image-less post found for default image metadata check",
		);
		return;
	}

	const relativePath = path.join(trimUrlPath(getPostUrl(post)), "index.html");
	const html = readDistFile(relativePath);
	const defaultImageUrl = getExpectedDefaultImageUrl();
	requireIncludes(`dist/${relativePath}`, html, [
		`<meta property="og:image" content="${defaultImageUrl}">`,
		`<meta name="twitter:image" content="${defaultImageUrl}">`,
		defaultImageUrl,
	]);

	const jsonLdNodes = getJsonLdNodes(html, `dist/${relativePath}`);
	const hasBlogPostingDefaultImage = jsonLdNodes.some(
		(node) =>
			nodeHasType(node, "BlogPosting") &&
			Array.isArray(node.image) &&
			node.image.includes(defaultImageUrl),
	);
	if (hasBlogPostingDefaultImage) {
		pass(`dist/${relativePath} BlogPosting JSON-LD has default image`);
	} else {
		fail(`dist/${relativePath} BlogPosting JSON-LD missing default image`);
	}
}

function verifyArticleLandmarks() {
	const post = getExpectedArchivePosts()[0];
	if (!post) {
		fail("No public post available for article landmark verification");
		return;
	}
	const relativePath = path.join(trimUrlPath(post.url), "index.html");
	const html = readDistFile(relativePath);
	const root = parse(html);
	if (root.querySelector(".banner-title")) {
		fail(`dist/${relativePath} renders the homepage banner H1`);
	} else {
		pass(`dist/${relativePath} excludes the homepage banner H1`);
	}
	if (root.querySelector("nav#navbar")) {
		pass(`dist/${relativePath} exposes the primary nav landmark`);
	} else {
		fail(`dist/${relativePath} missing nav#navbar landmark`);
	}
}

function verifyHomePagination(indexHtml) {
	const pageSize = getPageSize();
	const expectedUrls = getExpectedHomePostUrls();
	const expectedPageCount = Math.ceil(expectedUrls.length / pageSize);
	const actualUrls = [];

	for (let pageIndex = 0; pageIndex < expectedPageCount; pageIndex += 1) {
		const pageNumber = pageIndex + 1;
		const relativePath =
			pageNumber === 1 ? "index.html" : `${pageNumber}/index.html`;
		const pageHtml =
			pageNumber === 1 ? indexHtml : readDistFile(relativePath);
		const expectedPageUrls = expectedUrls.slice(
			pageIndex * pageSize,
			(pageIndex + 1) * pageSize,
		);
		const actualPageUrls = extractHomePostUrls(
			pageHtml,
			`dist/${relativePath}`,
		);
		requireSameList(
			`dist/${relativePath}`,
			actualPageUrls,
			expectedPageUrls,
			"latest-update order",
		);
		actualUrls.push(...actualPageUrls);
	}

	const duplicates = actualUrls.filter(
		(url, index) => actualUrls.indexOf(url) !== index,
	);
	if (duplicates.length > 0) {
		fail(
			`Home pagination contains duplicate posts: ${duplicates.join(", ")}`,
		);
		return;
	}
	pass("Home pagination has no duplicate posts across pages");
}

function getExpectedEssayPosts() {
	return walkMarkdownFiles(sourceEssaysDir)
		.map((filePath) => ({
			id: getEssayId(filePath),
			data: parseFrontmatter(filePath),
		}))
		.filter((post) => post.data.draft !== true)
		.map((post) => {
			const published = parseDate(post.data.published);
			if (!published) {
				fail(`${post.id} has an invalid published date`);
			}
			return {
				...post,
				published: published ?? new Date(0),
				url: getEssayUrl(post),
			};
		})
		.sort((a, b) => {
			const publishedDiff = b.published.getTime() - a.published.getTime();
			if (publishedDiff !== 0) {
				return publishedDiff;
			}
			return a.id.localeCompare(b.id);
		});
}

function verifyEssayPage(essayHtml) {
	const expectedEssays = getExpectedEssayPosts();
	const root = parse(essayHtml);
	const actualTitles = root
		.querySelectorAll(".essay-title")
		.map((title) => title.text.trim())
		.filter(Boolean);
	const expectedTitles = expectedEssays.map((post) => post.data.title);

	requireSameList(
		"dist/essays/index.html",
		actualTitles,
		expectedTitles,
		"published-date order",
	);

	for (const essay of expectedEssays) {
		const relativePath = path.join("posts", trimUrlPath(essay.id), "index.html");
		const fullPath = path.join(distDir, relativePath);
		if (fs.existsSync(fullPath)) {
			fail(`Essay ${essay.id} should not generate dist/${relativePath}`);
		} else {
			pass(`Essay ${essay.id} has no standalone dist/${relativePath}`);
		}
	}
}

function verifyArchivePage(archiveHtml) {
	const expectedPosts = getExpectedArchivePosts();
	for (const post of expectedPosts) {
		const encodedUrl = escapeHtmlAttribute(post.url);
		if (archiveHtml.includes(encodedUrl)) {
			pass(`Archive includes ${post.id}`);
		} else {
			fail(`Archive missing ${post.id}`);
		}
	}

	for (const essay of getExpectedEssayPosts()) {
		const encodedUrl = escapeHtmlAttribute(`/posts/${essay.id}/`);
		if (archiveHtml.includes(encodedUrl)) {
			fail(`Archive should not include essay ${essay.id}`);
		} else {
			pass(`Archive excludes essay ${essay.id}`);
		}
	}
}

function verifySponsorPage(sponsorHtml) {
	requireIncludes("sponsor/index.html", sponsorHtml, [
		"赞助",
		"/assets/sponsor/amiya_desi-Sharable-Profile-Vertical.jpg",
		"/assets/sponsor/afdian-Amiya_desi.jpg",
		"/assets/sponsor/amiya-desi-reward-code.png",
		"https://ko-fi.com/amiya_desi/tip",
		"https://ifdian.net/a/amiya_desi/plan",
		"感谢赞助",
		"Dna",
		"爱发电用户_04571",
		"爱发电用户_eYwj",
		"爱发电用户_1d601",
	]);
	const sponsorRoot = parse(sponsorHtml);
	if (
		sponsorRoot.querySelector(
			'a img[src="/assets/sponsor/amiya-desi-reward-code.png"]',
		)
	) {
		fail("Sponsor reward-code image must not be wrapped in a link");
	} else {
		pass("Sponsor reward-code image is not linked");
	}
	const sponsorJsonLdNodes = getJsonLdNodes(
		sponsorHtml,
		"sponsor/index.html",
	);
	requireJsonLdTypes("sponsor/index.html", sponsorJsonLdNodes, ["WebPage"]);
	requireNoJsonLdType("sponsor/index.html", sponsorJsonLdNodes, "Service");
}

function verifyTopicPage(topicHtml) {
	requireIncludes("topics/webmaster/index.html", topicHtml, [
		"Amiya_desi&#39;s webmaster topic page",
		"external webmaster resources",
		"browser extension list",
		"个人站长工具箱",
		"专题文章",
		"问答答案层",
		"实体与证据入口",
		"非商业边界",
		"/posts/astro-mizuki-blog-from-zero/",
		"/posts/free-domain-and-web-community/",
		"/posts/blog-resource-toolbox/",
		"/posts/site-article-index/",
		"/posts/useful-free-software-toolbox/",
		"/posts/useful-browser-extensions-toolbox/",
		"/posts/internet-community-1/",
		"/posts/internet-community-2-bangumi-and-doki/internet-community-2/",
	]);

	const topicJsonLdNodes = getJsonLdNodes(
		topicHtml,
		"topics/webmaster/index.html",
	);
	requireJsonLdTypes("topics/webmaster/index.html", topicJsonLdNodes, [
		"CollectionPage",
		"ItemList",
		"FAQPage",
	]);
	requireNoJsonLdType(
		"topics/webmaster/index.html",
		topicJsonLdNodes,
		"Service",
	);
	requireNoHref(
		"topics/webmaster/index.html",
		topicHtml,
		"/posts/indie-webmaster-projects/",
	);
	requireNoHref(
		"topics/webmaster/index.html",
		topicHtml,
		"/posts/internet-community-2/",
	);
	verifyVisibleFaqMatchesJsonLd(
		"topics/webmaster/index.html",
		topicHtml,
		topicJsonLdNodes,
	);
}

if (!fs.existsSync(distDir)) {
	throw new Error(`Blog dist directory not found: ${distDir}`);
}

const files = new Map(requiredFiles.map((file) => [file, readDistFile(file)]));

const indexHtml = files.get("index.html") || "";
const expectedHomeTitle =
	"Amiya的书桌 - 笔记、项目和一点日常折腾 | Amiya's Desk";
requireDocumentTitle("index.html", indexHtml, expectedHomeTitle);
requireIncludes("index.html", indexHtml, [
	'<meta name="description"',
	'<link rel="canonical"',
	'<link rel="sitemap"',
	"llms.txt",
	'property="og:title"',
	'name="twitter:card"',
	"application/ld+json",
	'id="random-post-jump-button"',
	"专题入口",
	"/topics/webmaster/",
	"/sponsor/",
]);
const indexJsonLdNodes = getJsonLdNodes(indexHtml, "index.html");
requireJsonLdTypes("index.html", indexJsonLdNodes, [
	"WebSite",
	"Person",
	"Blog",
	"Organization",
	"FAQPage",
	"ItemList",
]);
requireNoJsonLdType("index.html", indexJsonLdNodes, "Service");
verifyVisibleFaqMatchesJsonLd("index.html", indexHtml, indexJsonLdNodes);
verifyAnalyticsScripts(indexHtml);
verifyHomepageCriticalMedia(indexHtml);
verifyCssDelivery(indexHtml);
verifyLocalFontReferences();
verifyBlogMediaOutput();
verifyHomePagination(indexHtml);
verifyPostDefaultImageMetadata();
verifyArticleLandmarks();
verifySourceSecurityHeaders();
requireAnyHref("index.html", indexHtml, "/topics/webmaster/");
requireAnyHref("index.html", indexHtml, "/sponsor/");

const essayHtml = files.get("essays/index.html") || "";
verifyEssayPage(essayHtml);

const sponsorHtml = files.get("sponsor/index.html") || "";
verifySponsorPage(sponsorHtml);

const archiveHtml = files.get("archive/index.html") || "";
verifyArchivePage(archiveHtml);

const topicHtml = files.get("topics/webmaster/index.html") || "";
verifyTopicPage(topicHtml);

const adminGrowthHtml = files.get("admin/growth/index.html") || "";
requireIncludes("admin/growth/index.html", adminGrowthHtml, [
	'<meta name="robots" content="noindex, nofollow, noarchive">',
	"增长工作台",
]);
requireIncludes(
	"admin/growth bundled modules",
	readLinkedAstroModules(adminGrowthHtml),
	["/api/admin/growth/overview"],
);

const robotsTxt = files.get("robots.txt") || "";
requireIncludes("robots.txt", robotsTxt, [
	"User-agent: *",
	"Allow: /",
	"Disallow: /admin/",
	"Disallow: /api/",
	"Sitemap: https://blog.sayori.org/sitemap.xml",
]);
requireExcludes("robots.txt", robotsTxt, [
	"Content-Signal:",
	"LLMs:",
	"ai-train=no",
	"User-agent: GPTBot",
	"User-agent: ClaudeBot",
	"User-agent: Google-Extended",
	"User-agent: CCBot",
	"User-agent: Bytespider",
	"User-agent: Applebot-Extended",
]);

const sitemapCompat = files.get("sitemap.xml") || "";
requireIncludes("sitemap.xml", sitemapCompat, [
	"<sitemapindex",
	"https://blog.sayori.org/sitemap-0.xml",
]);

const sitemapIndex = files.get("sitemap-index.xml") || "";
requireIncludes("sitemap-index.xml", sitemapIndex, [
	"<sitemapindex",
	"https://blog.sayori.org/sitemap-0.xml",
]);

const sitemap = files.get("sitemap-0.xml") || "";
requireIncludes("sitemap-0.xml", sitemap, [
	"<urlset",
	"<loc>https://blog.sayori.org/</loc>",
	"<loc>https://blog.sayori.org/topics/webmaster/</loc>",
	"<lastmod>",
]);
requireExcludes("sitemap-0.xml", sitemap, ["https://blog.sayori.org/admin/"]);

const rss = files.get("rss.xml") || "";
requireIncludes("rss.xml", rss, [
	"<rss",
	"<channel>",
	"<item>",
	"blog.sayori.org",
]);

const atom = files.get("atom.xml") || "";
requireIncludes("atom.xml", atom, ["<feed", "<entry>", "blog.sayori.org"]);

const llms = files.get("llms.txt") || "";
requireIncludes("llms.txt", llms, [
	"# Amiya的书桌",
	"> Amiya的书桌 is Amiya_desi's personal blog",
	"## Core Links",
	"## Topics",
	"[个人站长工具箱](https://blog.sayori.org/topics/webmaster/)",
	"https://blog.sayori.org/posts/astro-mizuki-blog-from-zero/",
	"https://blog.sayori.org/posts/free-domain-and-web-community/",
	"## Recent Posts",
	"- Sitemap: https://blog.sayori.org/sitemap.xml",
	"Search indexing, real-time AI grounding, AI citation, and model training uses are allowed for public content",
]);
requireExcludes("llms.txt", llms, [
	"Model training is not granted",
	"ai-train=no",
	"Content-Signal declaration in robots.txt",
]);

if (failed) {
	throw new Error("Build output verification failed.");
}

console.log("✓ Build output verification passed.");
