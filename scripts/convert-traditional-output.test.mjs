import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";

import { convertHtml, convertProtectedText } from "./convert-traditional-output.mjs";

test("Traditional conversion preserves code, URLs, paths, and JSON-LD identifiers", () => {
	const html = convertHtml(`<!doctype html><html><head><meta name="description" content="软件开发"><script type="application/ld+json">{"name":"软件开发","url":"https://sayori.org/软件/"}</script></head><body><p title="软件">软件与服务器</p><code>软件开发</code></body></html>`);
	assert.match(html, /軟件與服務器/);
	assert.match(html, /content="軟件開發"/);
	assert.match(html, /title="軟件"/);
	assert.match(html, /<code>软件开发<\/code>/);
	assert.match(html, /https:\/\/sayori\.org\/软件\//);

	const markdown = convertProtectedText("软件 `服务器` https://sayori.org/软件/ `/软件/path`");
	assert.equal(markdown, "軟件 `服务器` https://sayori.org/软件/ `/软件/path`");
});

test("Traditional conversion preserves adjacent compiled multiline templates", () => {
	const source = 'const first = `<a class="link">\n搜索</a>`, second = `<div>\n<input class="field"/></div>`; const label = `icon ${first ?? ""}`;';
	const converted = convertProtectedText(source);
	assert.doesNotMatch(converted, /OPENCCPROTECTED\d+TOKEN/);
	assert.doesNotThrow(() => new Script(converted));
});
