import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import { blogLocales, extraLocales } from "../src/utils/blog-locales.mjs";

// Each Astro build sees one locale. Link explicit translations only after merging
// the final sitemaps, which exclude drafts, private pages and redirect aliases.
export function linkPostTranslations(distDir) {
	const groups = new Map();
	for (const { base, hreflang: locale } of blogLocales) {
		const sitemapPath = path.join(distDir, base, "sitemap-0.xml");
		if (extraLocales.some((locale) => locale.base === base) && !fs.existsSync(sitemapPath)) continue;
		const sitemap = parse(fs.readFileSync(sitemapPath, "utf8"));
		for (const location of sitemap.querySelectorAll("loc")) {
			const href = location.text;
			const file = path.join(distDir, decodeURIComponent(new URL(href).pathname), "index.html");
			const source = useOriginalForMissingLinks(fs.readFileSync(file, "utf8"), distDir, base);
			const document = parse(source, { comment: true });
			const article = document.querySelector("#post-container");
			if (!article) {
				if (extraLocales.some((locale) => locale.base === base)) fs.writeFileSync(file, source);
				continue;
			}
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
			const available = new Map(group.map(({ locale, href }) => [locale, new URL(href).pathname]));
			const output = source.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, () => head.toString())
				.replace(/<select\b[^>]*data-language-switch[^>]*>[\s\S]*?<\/select>/gi, (selectMarkup) => {
					const select = parse(selectMarkup).querySelector("select");
					for (const option of select.querySelectorAll("option[data-hreflang]")) {
						const label = option.getAttribute("data-hreflang");
						const target = available.get(label);
						if (target) option.setAttribute("value", target);
						else if (select.hasAttribute("data-article-switch")) option.remove();
						else {
							const base = blogLocales.find(({ hreflang }) => hreflang === label)?.base;
							option.setAttribute("value", base ? `/${base}/` : "/");
						}
					}
					return select.toString();
				});
			fs.writeFileSync(file, output);
			count++;
		}
	}
	return count;
}

function useOriginalForMissingLinks(source, distDir, base) {
	if (!extraLocales.some((locale) => locale.base === base)) return source;
	return source.replace(/<a\s[^>]*>/gi, (tag) => {
		const match = tag.match(/\shref="([^"#?]+)([^"]*)"/i);
		const pathname = match?.[1];
		if (!pathname?.startsWith(`/${base}/`) || !pathname.endsWith("/")) return tag;
		const getPage = (route) => path.join(distDir, decodeURI(route), "index.html");
		const original = pathname.slice(base.length + 1);
		if (fs.existsSync(getPage(pathname)) || !fs.existsSync(getPage(original))) return tag;
		return tag.replace(match[0], () => ` href="${original}${match[2]}" hreflang="zh-Hans"`);
	});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	console.log(`[link-post-translations] linked ${linkPostTranslations(path.resolve("dist"))} article pages`);
}
