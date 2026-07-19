import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("fixed paper theme contract", () => {
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
});
