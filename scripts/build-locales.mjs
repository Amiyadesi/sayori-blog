import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = path.join(root, ".codex-tmp", "locales");
const dist = path.join(root, "dist");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

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

run(["run", "update-anime"], { SITE_LANG: "zh_CN", SITE_BASE: "/" });

for (const locale of [
	{ name: "zh", lang: "zh_CN", base: "/" },
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
	fs.cpSync(outDir, locale.name === "zh" ? dist : path.join(dist, "en"), {
		recursive: true,
	});
}

run(["run", "sync-content"], { SITE_LANG: "zh_CN", SITE_BASE: "/" });
for (const localeBase of ["", "en"]) {
	run(["node", "scripts/prune-disabled-pages.mjs"], {
		PRUNE_BASE: localeBase,
	});
}

// Keep the submitted root sitemap index aware of both locale sitemaps.
// The English build lives under /en/, so Astro's generated root index alone
// would otherwise leave the translated pages undiscoverable.
const localeSitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\t<sitemap><loc>https://blog.sayori.org/sitemap-0.xml</loc></sitemap>\n\t<sitemap><loc>https://blog.sayori.org/en/sitemap-0.xml</loc></sitemap>\n</sitemapindex>\n`;
fs.writeFileSync(path.join(dist, "sitemap-index.xml"), localeSitemapIndex);
fs.writeFileSync(path.join(dist, "sitemap.xml"), localeSitemapIndex);
run(["pagefind", "--site", "dist"]);
run(["node", "scripts/compress-fonts.js"]);
run(["node", "scripts/optimize-html-assets.mjs"]);

console.log(
	"[build-locales] zh-CN and en builds merged into dist/ and dist/en/",
);
