import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sayori-translate-"));
try {
	const folder = path.join(root, "posts", "example");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "example.md"), '---\ntitle: 书桌\npublished: 2026-10-05\nupdateCount: 7\nimage: "书桌.png"\n---\n书桌 [[书桌#^block|笔记]]\n\n![书桌](书桌.png)\n\n`简体代码` ^block\n');
	fs.writeFileSync(path.join(folder, "example.en.md"), '---\ntitle: Desk\npublished: 2020-01-01\nupdateCount: 1\n---\nEnglish body stays.\n');
	fs.writeFileSync(path.join(folder, "example.zh-hant.md"), "Outdated version");
	const result = spawnSync(process.execPath, [new URL("./translate-content.mjs", import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, "")], {
		encoding: "utf8",
		env: { ...process.env, CONTENT_DIR: root, TRANSLATE_MATCH: "", TRANSLATE_FORCE: "", TRANSLATE_METADATA_ONLY: "1" },
	});
	assert.equal(result.status, 0, result.stderr);
	const english = fs.readFileSync(path.join(folder, "example.en.md"), "utf8");
	assert.match(english, /published: 2026-10-05/);
	assert.match(english, /updateCount: 7/);
	assert.match(english, /English body stays/);
	const traditional = fs.readFileSync(path.join(folder, "example.zh-hant.md"), "utf8");
	assert.match(traditional, /書桌/);
	assert.match(traditional, /lang: zh-Hant/);
	assert.ok(traditional.includes('image: "书桌.png"'));
	assert.ok(traditional.includes("[[书桌#^block|筆記]]"));
	assert.ok(traditional.includes("(书桌.png)"));
	assert.ok(traditional.includes("`简体代码` ^block"));
	assert.equal(fs.readdirSync(folder).length, 3, "translated files must not become new source files");
} finally {
	assert.ok(root.startsWith(path.join(os.tmpdir(), "sayori-translate-")));
	fs.rmSync(root, { recursive: true, force: true });
}
