import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("diary pruning retains compressed fonts referenced by all three locales", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sayori-diary-prune-"));
	try {
		for (const locale of ["", "en", "zh-hant"]) {
			const arg = path.join(root, "dist", locale, "unsaved");
			fs.mkdirSync(arg, { recursive: true });
			fs.writeFileSync(path.join(arg, "index.html"), "public ARG must not enter diary build");
			const fonts = path.join(root, "dist", locale, "assets/font");
			fs.mkdirSync(fonts, { recursive: true });
			for (const name of ["ZenMaruGothic-Medium.ttf", "ZenMaruGothic-Medium.woff2", "unused.ttf"]) {
				fs.writeFileSync(path.join(fonts, name), "fixture");
			}
		}
		execFileSync(process.execPath, [fileURLToPath(new URL("prune-sayori-diary.mjs", import.meta.url))], { cwd: root });
		for (const locale of ["", "en", "zh-hant"]) {
			assert.ok(!fs.existsSync(path.join(root, "dist", locale, "unsaved")));
			const fonts = path.join(root, "dist", locale, "assets/font");
			assert.ok(fs.existsSync(path.join(fonts, "ZenMaruGothic-Medium.woff2")));
			assert.ok(!fs.existsSync(path.join(fonts, "unused.ttf")));
		}
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});
