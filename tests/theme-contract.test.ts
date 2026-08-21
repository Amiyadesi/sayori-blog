import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("fixed paper theme contract", () => {
	it("loads the shared theme variables for every page", () => {
		const layout = read("src/layouts/Layout.astro");

		assert.match(layout, /import "\.\.\/styles\/variables\.styl";/);
	});

	it("locks the public theme and removes the hue picker from the rendered navbar", () => {
		const config = read("src/config.ts");
		const navbar = read("src/components/organisms/navigation/Navbar.astro");

		assert.match(config, /themeColor:\s*{[\s\S]*?fixed:\s*true/);
		assert.doesNotMatch(navbar, /DisplaySettings/);
		assert.doesNotMatch(navbar, /display-settings-switch/);
	});

	it("migrates legacy hue storage before first paint", () => {
		const head = read("src/layouts/partials/HeadTags.astro");

		assert.match(head, /localStorage\.removeItem\("hue"\)/);
		assert.doesNotMatch(head, /localStorage\.getItem\("hue"\)/);
	});

	it("uses neutral paper tokens instead of hue-derived surface colors", () => {
		const variables = read("src/styles/variables.styl");

		assert.match(variables, /--page-bg:\s*oklch\([^\n]*0\.00/);
		assert.match(variables, /--card-bg:\s*oklch\([^\n]*0\.00/);
		assert.doesNotMatch(variables, /var\(--hue\)/);
	});

	it("keeps category count badges readable in both themes", () => {
		const buttonLink = read("src/components/control/ButtonLink.astro");

		assert.match(buttonLink, /class="[\s\S]*text-black[\s\S]*bg-\[var\(--btn-regular-bg\)\]/);
		assert.doesNotMatch(buttonLink, /dark:text-\[var\(--deep-text\)\]/);
	});

	it("invalidates stale PWA assets after a deployment", () => {
		const worker = read("public/sw.js");

		assert.match(worker, /CACHE_NAME\s*=\s*["']sayori-blog-v2["']/);
		assert.match(worker, /fetch\(request,\s*\{\s*cache:\s*["']no-store["']/);
	});

	it("keeps photo carousel controls clear of fixed floating controls", () => {
		const markdown = read("src/styles/markdown.css");

		assert.match(markdown, /\.sayori-photo-carousel\s*\{[\s\S]*grid-template-columns:\s*1fr auto auto 1fr;/);
		assert.match(markdown, /\.sayori-photo-carousel-track\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1;[\s\S]*grid-row:\s*1;/);
		assert.match(markdown, /\.sayori-photo-carousel__button\s*\{[\s\S]*grid-row:\s*2;/);
	});
});
