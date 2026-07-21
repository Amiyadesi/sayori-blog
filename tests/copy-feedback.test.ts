import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { getCopyFeedbackMessages } from "../src/utils/copy-feedback.ts";

const root = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("copy feedback", () => {
	it("localizes Chinese and English copy states", () => {
		assert.deepEqual(getCopyFeedbackMessages("zh-CN"), {
			action: "复制代码",
			working: "正在复制...",
			success: "已复制",
			error: "复制失败，请手动复制",
		});
		assert.equal(getCopyFeedbackMessages("en-US").working, "Copying...");
	});

	it("mounts one global live-region overlay in the site layout", () => {
		const layout = read("src/layouts/Layout.astro");
		const feedback = read("src/components/misc/CopyFeedback.astro");

		assert.match(layout, /<CopyFeedback\s*\/>/);
		assert.match(feedback, /role="status"/);
		assert.match(feedback, /aria-live="polite"/);
		assert.match(feedback, /addEventListener\("copy"/);
	});

	it("routes code-block copies through the visible feedback flow", () => {
		const markdown = read("src/components/misc/Markdown.astro");

		assert.match(markdown, /copyTextWithFeedback\(code\)/);
		assert.match(markdown, /aria-busy/);
	});
});
