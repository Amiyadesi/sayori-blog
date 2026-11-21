import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

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

test("segmented translation keeps distinct link placeholders when restoring a segment", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sayori-translate-segment-"));
	const post = path.join(dir, "posts", "example.md");
	fs.mkdirSync(path.dirname(post));
	const links = ["https://sayori.org/", "https://blog.sayori.org/", "https://nav.sayori.org/"];
	fs.writeFileSync(post, "---\ntitle: Desk\n---\n[Home](" + links[0] + ") " + "desk ".repeat(850) +
		"\n\n[Blog](" + links[1] + ") and [Nav](" + links[2] + ")\n");
	const server = createServer(async (req, res) => {
		let body = "";
		for await (const chunk of req) body += chunk;
		const prompt = JSON.parse(body).messages.at(-1).content;
		const content = prompt.split("---BEGIN SOURCE---\n")[1].split("\n---END SOURCE---")[0];
		res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }));
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		const child = spawn(process.execPath, [fileURLToPath(new URL("./translate-content.mjs", import.meta.url))], {
			env: {
				...process.env, CONTENT_DIR: dir, TRANSLATE_MATCH: "", TRANSLATE_FORCE: "",
				TRANSLATE_METADATA_ONLY: "", TRANSLATE_RUNNER: "", TRANSLATE_LOCALE: "fr", TRANSLATE_API_KEY: "test",
				TRANSLATE_BASE_URL: `http://127.0.0.1:${server.address().port}`, TRANSLATE_SEGMENT_THRESHOLD: "4000",
				TRANSLATE_SEGMENT_CHARS: "1500", TRANSLATE_TIMEOUT_MS: "30000",
			},
		});
		let error = "";
		child.stderr.setEncoding("utf8").on("data", (chunk) => { error += chunk; });
		const [code] = await once(child, "close");
		assert.equal(code, 0, error);
		const translated = fs.readFileSync(post.replace(".md", ".fr.md"), "utf8");
		assert.ok(translated.includes(`[Blog](${links[1]}) and [Nav](${links[2]})`));
	} finally {
		server.close();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
