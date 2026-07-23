import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("growth workbench UI", () => {
	it("puts evidence-backed next actions before analysis and distribution controls", () => {
		const component = read("src/components/features/admin/GrowthWorkbench.astro");
		assert.ok(component.indexOf("data-growth-actions") < component.indexOf("data-growth-analysis-form"));
		assert.ok(component.indexOf("data-growth-analysis-form") < component.indexOf("data-growth-distribution-form"));
	});

	it("keeps external calls explicit and renders independent source states", () => {
		const script = read("src/scripts/growth-workbench.ts");
		assert.match(script, /addEventListener\("submit", runAnalysis\)/);
		assert.match(script, /eventName === "source"/);
		assert.match(script, /not_configured/);
		assert.doesNotMatch(script, /setInterval\([^)]*runAnalysis/);
	});

	it("generates an evidence package rather than a reusable platform post", () => {
		const component = read("src/components/features/admin/GrowthWorkbench.astro");
		const script = read("src/scripts/growth-workbench.ts");
		assert.match(component, /可核验事实/);
		assert.match(component, /证据与出处/);
		assert.match(script, /## 渠道结构/);
		assert.match(script, /不要自动发布|自动发布/);
	});
});
