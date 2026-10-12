import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/layouts/partials/HeadTags.astro", import.meta.url), "utf8");
const script = source.match(/<script is:inline>\s*(\(\(\) => \{\s*const normalize[\s\S]*?)<\/script>/)[1];

test("article language URLs stay stable; only an explicit lang query redirects", () => {
	for (const [path, expected] of [["/posts/example/", ""], ["/en/posts/example/", ""], ["/zh-hant/posts/example/", ""], ["/posts/example/?lang=en#comments", "/en/posts/example/#comments"]]) {
		let redirect = "";
		let requests = 0;
		const url = new URL(path, "https://blog.sayori.org");
		const context = {
			URL, document: { cookie: "sayori_locale=en" }, navigator: { language: "en-US" },
			localStorage: { getItem: () => "en", setItem() {} },
			location: { href: url.href, pathname: url.pathname, replace(value) { redirect = value; } },
			fetch() { requests++; return new Promise(() => {}); },
		};
		context.window = context;
		vm.runInNewContext(script, context);
		assert.equal(redirect, expected);
		assert.equal(requests, 0);
	}
});
