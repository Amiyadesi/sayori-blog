import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const footerHtml = fs.readFileSync(
	path.join(process.cwd(), "src", "FooterConfig.html"),
	"utf8",
);
const footerComponent = fs.readFileSync(
	path.join(
		process.cwd(),
		"src",
		"components",
		"organisms",
		"footer",
		"Footer.astro",
	),
	"utf8",
);

describe("public footer records", () => {
	it("shows the ICP records together with safe external links", () => {
		assert.match(footerHtml, /萌ICP备20260605号/);
		assert.match(footerHtml, /https:\/\/icp\.gov\.moe\/\?keyword=20260605/);
		assert.match(footerHtml, /茶ICP备2026070378号/);
		assert.match(
			footerHtml,
			/https:\/\/icp\.redcha\.cn\/beian\/ICP-2026070378\.html/,
		);
		assert.match(footerHtml, /假ICP备1202613号/);
		assert.match(
			footerHtml,
			/https:\/\/fakeicp\.top\/query\.html\?number=1202613/,
		);
		assert.match(footerHtml, /class="transition link text-\[var\(--primary\)\] font-medium"/);
		assert.doesNotMatch(footerHtml, /data:image\/svg\+xml/);

		const externalLinks = footerHtml.match(/<a\b[\s\S]*?<\/a>/g) ?? [];
		assert.equal(externalLinks.length, 3);
		for (const link of externalLinks) {
			assert.match(link, /target="_blank"/);
			assert.match(link, /rel="noopener noreferrer"/);
		}
	});

	it("keeps the public blog-network entry points in the footer", () => {
		for (const href of [
			"https://www.blogsclub.org/",
			"https://blogscn.fun/",
			"https://bo.ke/",
			"https://www.travellings.cn/go.html",
		]) {
			assert.ok(footerComponent.includes(href), href);
		}
	});
});
