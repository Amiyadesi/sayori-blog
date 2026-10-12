import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "node-html-parser";
import { linkPostTranslations } from "./link-post-translations.mjs";

function fixture(t, pages) {
	const dist = fs.mkdtempSync(path.join(os.tmpdir(), "post-translations-"));
	t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
	for (const page of pages) {
		const file = path.join(dist, page.route, "index.html");
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, `<!doctype html><html><head><link rel="canonical" href="https://blog.sayori.org${page.route}"><meta name="robots" content="${page.noindex ? "noindex" : "index"}"><link rel="alternate" hreflang="en" href="https://blog.sayori.org/old/"><link rel="alternate" type="application/rss+xml" href="/rss.xml"><script>const value = "<b>&";</script><!-- keep --></head><body><article id="post-container" data-translation-key="${page.key}"><pre>  keep\n spacing &amp; entities</pre></article></body></html>`);
	}
	for (const base of ["", "zh-hant", "en"]) {
		fs.mkdirSync(path.join(dist, base), { recursive: true });
		const submitted = pages.filter((page) => page.base === base && !page.excluded);
		fs.writeFileSync(path.join(dist, base, "sitemap-0.xml"), `<urlset>${submitted.map((page) => `<url><loc>https://blog.sayori.org${page.route}</loc></url>`).join("")}</urlset>`);
	}
	return dist;
}

function alternates(dist, route) {
	return Object.fromEntries(parse(fs.readFileSync(path.join(dist, route, "index.html"), "utf8"))
		.querySelectorAll('head link[rel="alternate"][hreflang]')
		.map((link) => [link.getAttribute("hreflang"), link.getAttribute("href")]));
}

test("merged builds link reciprocal translations by key, including different permalinks", (t) => {
	const pages = [
		{ base: "", route: "/posts/article/", key: "shared" },
		{ base: "zh-hant", route: "/zh-hant/posts/article/", key: "shared" },
		{ base: "en", route: "/en/custom-permalink/", key: "shared" },
		{ base: "en", route: "/en/old-alias/", key: "shared", excluded: true },
	];
	const dist = fixture(t, pages);
	const original = fs.readFileSync(path.join(dist, pages[0].route, "index.html"), "utf8");
	assert.equal(linkPostTranslations(dist), 3);
	for (const page of pages.filter((page) => !page.excluded)) {
		assert.deepEqual(alternates(dist, page.route), {
			"zh-Hans": "https://blog.sayori.org/posts/article/",
			"zh-Hant": "https://blog.sayori.org/zh-hant/posts/article/",
			en: "https://blog.sayori.org/en/custom-permalink/",
			"x-default": "https://blog.sayori.org/posts/article/",
		});
	}
	const output = fs.readFileSync(path.join(dist, pages[0].route, "index.html"), "utf8");
	assert.equal(output.split("</head>")[1], original.split("</head>")[1]);
	assert.match(output, /<script>const value = "<b>&";<\/script><!-- keep -->/);
	assert.match(output, /type="application\/rss\+xml"/);
	linkPostTranslations(dist);
	assert.equal(fs.readFileSync(path.join(dist, pages[0].route, "index.html"), "utf8"), output);
});

test("missing translations and unrelated same-slug pages do not create imaginary alternates", (t) => {
	const pages = [
		{ base: "", route: "/posts/solo/", key: "" },
		{ base: "en", route: "/en/posts/solo/", key: "" },
		{ base: "zh-hant", route: "/zh-hant/posts/partial/", key: "partial" },
		{ base: "en", route: "/en/posts/partial/", key: "partial" },
	];
	const dist = fixture(t, pages);
	linkPostTranslations(dist);
	assert.deepEqual(alternates(dist, pages[0].route), {
		"zh-Hans": "https://blog.sayori.org/posts/solo/", "x-default": "https://blog.sayori.org/posts/solo/",
	});
	assert.deepEqual(alternates(dist, pages[1].route), {
		en: "https://blog.sayori.org/en/posts/solo/", "x-default": "https://blog.sayori.org/en/posts/solo/",
	});
	assert.deepEqual(alternates(dist, pages[2].route), alternates(dist, pages[3].route));
	assert.equal(alternates(dist, pages[2].route)["zh-Hans"], undefined);
});

test("duplicate locale keys and private sitemap entries fail the build", (t) => {
	const duplicate = fixture(t, [
		{ base: "", route: "/posts/a/", key: "same" },
		{ base: "", route: "/posts/b/", key: "same" },
	]);
	assert.throws(() => linkPostTranslations(duplicate), /Duplicate zh-Hans translation/);
	const privatePage = fixture(t, [{ base: "", route: "/posts/private/", key: "private", noindex: true }]);
	assert.throws(() => linkPostTranslations(privatePage), /Nonindexable translation/);
});
