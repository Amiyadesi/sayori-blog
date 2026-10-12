import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

// Each Astro build sees one locale. Link explicit translations only after merging
// the final sitemaps, which exclude drafts, private pages and redirect aliases.
export function linkPostTranslations(distDir) {
	const groups = new Map();
	for (const [base, locale] of [["", "zh-Hans"], ["zh-hant", "zh-Hant"], ["en", "en"]]) {
		const sitemap = parse(fs.readFileSync(path.join(distDir, base, "sitemap-0.xml"), "utf8"));
		for (const location of sitemap.querySelectorAll("loc")) {
			const href = location.text;
			const file = path.join(distDir, decodeURIComponent(new URL(href).pathname), "index.html");
			const source = fs.readFileSync(file, "utf8");
			const document = parse(source, { comment: true });
			const article = document.querySelector("#post-container");
			if (!article) continue;
			const key = article.getAttribute("data-translation-key");
			assert.notEqual(key, undefined, `Missing translation metadata: ${href}`);
			assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute("href"), href);
			assert(!document.querySelector('meta[name="robots"]')?.getAttribute("content")?.includes("noindex"), `Nonindexable translation: ${href}`);
			const group = groups.get(key.trim() || href) || [];
			assert(!group.some((page) => page.locale === locale), `Duplicate ${locale} translation: ${key}`);
			group.push({ file, source, head: document.querySelector("head"), href, locale });
			groups.set(key.trim() || href, group);
		}
	}
	let count = 0;
	for (const group of groups.values()) {
		const defaultUrl = group.find((page) => page.locale === "zh-Hans")?.href
			|| group.find((page) => page.locale === "en")?.href || group[0].href;
		const alternates = [...group.map(({ locale, href }) => [locale, href]), ["x-default", defaultUrl]];
		const links = alternates.map(([locale, href]) => {
			const link = parse('<link rel="alternate">').firstChild;
			link.setAttribute("hreflang", locale);
			link.setAttribute("href", href);
			return link.toString();
		}).join("");
		for (const { file, source, head } of group) {
			for (const link of head.querySelectorAll('link[rel="alternate"][hreflang]')) link.remove();
			head.insertAdjacentHTML("beforeend", links);
			fs.writeFileSync(file, source.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, () => head.toString()));
			count++;
		}
	}
	return count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	console.log(`[link-post-translations] linked ${linkPostTranslations(path.resolve("dist"))} article pages`);
}
