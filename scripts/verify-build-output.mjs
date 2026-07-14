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

	return relativePath.endsWith("/index")
		? relativePath.slice(0, -"/index".length)
		: relativePath;
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
		"https://ko-fi.com/amiya_desi/tip",
		"https://ifdian.net/a/amiya_desi/plan",
		"感谢赞助",
		"Dna",
		"爱发电用户_04571",
		"爱发电用户_eYwj",
		"爱发电用户_1d601",
	]);
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
verifyHomePagination(indexHtml);
verifyPostDefaultImageMetadata();
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
