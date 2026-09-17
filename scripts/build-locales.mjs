import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = path.join(root, ".codex-tmp", "locales");
const dist = path.join(root, "dist");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const siteOrigin = String(
	process.env.SITE_URL ||
		(process.env.SITE_VARIANT === "sayori-diary"
			? "https://diary.sayori.org/"
			: "https://blog.sayori.org/"),
)
	.replace(/\/+$/, "");

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

if (process.env.SITE_VARIANT !== "sayori-diary") {
	run(["run", "update-anime"], { SITE_LANG: "zh_CN", SITE_BASE: "/" });
}

for (const locale of [
	{ name: "zh", lang: "zh_CN", base: "/" },
	{ name: "zh-hant", lang: "zh_TW", base: "/zh-hant/" },
	{ name: "en", lang: "en", base: "/en/" },
]) {
	const outDir = path.join(tempRoot, locale.name);
	run(["run", "sync-content"], {
		SITE_LANG: locale.lang,
		SITE_BASE: locale.base,
	});
	run(["astro", "build", "--outDir", path.relative(root, outDir)], {
		SITE_LANG: locale.lang,
		SITE_BASE: locale.base,
	});
	if (locale.name === "zh-hant") {
		run(["node", "scripts/convert-traditional-output.mjs", outDir]);
	}
	if (locale.name !== "zh") {
		for (const privateRoute of ["admin", "api"]) {
			fs.rmSync(path.join(outDir, privateRoute), { recursive: true, force: true });
		}
	}
	fs.cpSync(outDir, locale.name === "zh" ? dist : path.join(dist, locale.name), {
		recursive: true,
	});
}

run(["run", "sync-content"], { SITE_LANG: "zh_CN", SITE_BASE: "/" });
for (const localeBase of ["", "zh-hant", "en"]) {
	run(["node", "scripts/prune-disabled-pages.mjs"], {
		PRUNE_BASE: localeBase,
	});
}
for (const localeBase of ["zh-hant", "en"]) pruneLocalizedSitemap(localeBase);

// Keep the submitted root sitemap index aware of both locale sitemaps.
// The English build lives under /en/, so Astro's generated root index alone
// would otherwise leave the translated pages undiscoverable.
const localeSitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\t<sitemap><loc>${siteOrigin}/sitemap-0.xml</loc></sitemap>\n\t<sitemap><loc>${siteOrigin}/zh-hant/sitemap-0.xml</loc></sitemap>\n\t<sitemap><loc>${siteOrigin}/en/sitemap-0.xml</loc></sitemap>\n</sitemapindex>\n`;
fs.writeFileSync(path.join(dist, "sitemap-index.xml"), localeSitemapIndex);
fs.writeFileSync(path.join(dist, "sitemap.xml"), localeSitemapIndex);
if (process.env.SITE_VARIANT !== "sayori-diary") {
	run(["pagefind", "--site", "dist"]);
}
run(["node", "scripts/compress-fonts.js"]);
run(["node", "scripts/optimize-html-assets.mjs"]);
if (process.env.SITE_VARIANT === "sayori-diary") {
	run(["node", "scripts/prune-sayori-diary.mjs"]);
}

console.log(
	"[build-locales] zh-CN, zh-Hant, and en builds merged into dist/",
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
		return blocked.some((route) => relative.startsWith(route)) || /^\d+\/$/.test(relative)
			? ""
			: entry;
	});
	fs.writeFileSync(sitemapPath, output, "utf8");
}
