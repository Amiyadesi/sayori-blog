import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coreLocales, extraLocales, localizedReadingRoutes } from "../src/utils/blog-locales.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = process.env.BLOG_BUILD_TEMP_DIR
	? path.resolve(process.env.BLOG_BUILD_TEMP_DIR)
	: path.join(root, ".codex-tmp", "locales");
if (tempRoot === root || root.startsWith(tempRoot + path.sep)) throw new Error("Unsafe build temporary directory");
const dist = path.join(root, "dist");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const siteOrigin = String(
	process.env.SITE_URL ||
		(process.env.SITE_VARIANT === "sayori-diary"
			? "https://diary.sayori.org/"
			: "https://blog.sayori.org/"),
)
	.replace(/\/+$/, "");
const isDiary = process.env.SITE_VARIANT === "sayori-diary";
const locales = isDiary ? coreLocales : [...coreLocales, ...extraLocales];
const supportedReadingDirectories = new Set(localizedReadingRoutes.filter((route) => route !== "/").map((route) => route.slice(1, -1)));

function run(args, env = {}) {
	console.log(`[build-locales] ${pnpm} ${args.join(" ")}`);
	execFileSync(pnpm, args, {
		cwd: root,
		env: { ...process.env, NODE_ENV: "production", ...env },
		shell: process.platform === "win32",
		stdio: "inherit",
	});
}

fs.rmSync(tempRoot, { recursive: true, force: true });
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(tempRoot, { recursive: true });

if (process.env.SITE_VARIANT !== "sayori-diary" && process.env.BLOG_SKIP_ANIME_UPDATE !== "1") {
	run(["run", "update-anime"], { SITE_LANG: "zh_CN", SITE_BASE: "/" });
}

for (const locale of locales) {
	const outDir = path.join(tempRoot, locale.base || "zh");
	const buildEnv = { SITE_LANG: locale.build, SITE_BASE: locale.base ? `/${locale.base}/` : "/" };
	run(["run", "sync-content"], {
		...buildEnv,
	});
	run(["astro", "build", "--outDir", path.relative(root, outDir)], {
		...buildEnv,
	});
	if (locale.base === "zh-hant") {
		run(["node", "scripts/convert-traditional-output.mjs", outDir]);
	}
	if (locale.base) {
		for (const privateRoute of ["admin", "api"]) {
			fs.rmSync(path.join(outDir, privateRoute), { recursive: true, force: true });
		}
	}
	const isExtra = extraLocales.some(({ id }) => id === locale.id);
	fs.cpSync(outDir, path.join(dist, locale.base), {
		recursive: true,
		filter: isExtra ? (source) => {
			const top = path.relative(outDir, source).split(path.sep)[0];
			return !top || supportedReadingDirectories.has(top) || /^\d+$/.test(top) || ["index.html", "sitemap-0.xml", "rss.xml", "atom.xml", "posts", "_astro", "og"].includes(top);
		} : undefined,
	});
}

run(["run", "sync-content"], { SITE_LANG: "zh_CN", SITE_BASE: "/" });
for (const localeBase of ["", "zh-hant", "en"]) {
	run(["node", "scripts/prune-disabled-pages.mjs"], {
		PRUNE_BASE: localeBase,
	});
}
for (const { base } of locales) if (base) pruneLocalizedSitemap(base);

// Keep the submitted root sitemap index aware of both locale sitemaps.
// The English build lives under /en/, so Astro's generated root index alone
// would otherwise leave the translated pages undiscoverable.
const localeSitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locales.map(({ base }) => `\t<sitemap><loc>${siteOrigin}/${base ? `${base}/` : ""}sitemap-0.xml</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
fs.writeFileSync(path.join(dist, "sitemap-index.xml"), localeSitemapIndex);
fs.writeFileSync(path.join(dist, "sitemap.xml"), localeSitemapIndex);
if (process.env.SITE_VARIANT !== "sayori-diary") {
	run(["node", "scripts/link-post-translations.mjs"]);
	run(["pagefind", "--site", "dist"]);
}
run(["node", "scripts/compress-fonts.js"]);
const sharedFonts = path.join(dist, "assets", "font");
if (!isDiary && fs.existsSync(sharedFonts)) {
	for (const { base } of extraLocales) fs.cpSync(sharedFonts, path.join(dist, base, "assets", "font"), { recursive: true });
}
run(["node", "scripts/optimize-html-assets.mjs"]);
if (process.env.SITE_VARIANT === "sayori-diary") {
	run(["node", "scripts/prune-sayori-diary.mjs"]);
}

console.log(
	`[build-locales] ${locales.map(({ id }) => id).join(", ")} merged into dist/`,
);

function pruneLocalizedSitemap(localeBase) {
	const sitemapPath = path.join(dist, localeBase, "sitemap-0.xml");
	if (!fs.existsSync(sitemapPath)) return;
	const prefix = `/${localeBase}/`;
	const blocked = [
		"admin/", "api/", "albums/", "devices/", "diary/", "projects/", "skills/",
		"posts/diary/", "rss/", "atom/",
	];
	const source = fs.readFileSync(sitemapPath, "utf8");
	const output = source.replace(/<url>[\s\S]*?<\/url>/g, (entry) => {
		const pathname = entry.match(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/)?.[1] || "";
		const relative = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
		return blocked.some((route) => relative.startsWith(route)) || /^\d+\/$/.test(relative) ||
			(extraLocales.some(({ base }) => base === localeBase) && !localizedReadingRoutes.includes(`/${relative}`) && !relative.startsWith("posts/"))
			? ""
			: entry;
	});
	fs.writeFileSync(sitemapPath, output, "utf8");
}
