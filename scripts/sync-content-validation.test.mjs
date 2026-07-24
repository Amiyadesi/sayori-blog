import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(
	fileURLToPath(new URL("./sync-content.js", import.meta.url)),
);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "blog-sync-validation-"));
const isolatedEnv = {
	...process.env,
	BLOG_MEDIA_BASE_URL: "",
	BLOG_MEDIA_MANIFEST: "",
	BLOG_MEDIA_REQUIRED: "",
};

try {
	const blogRoot = path.join(tmpRoot, "sayori-blog");
	const contentRoot = path.join(tmpRoot, "sayori-articles");
	const scriptPath = path.join(blogRoot, "scripts", "sync-content.js");
	fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
	fs.copyFileSync(path.join(scriptsRoot, "sync-content.js"), scriptPath);
	fs.copyFileSync(
		path.join(scriptsRoot, "load-env.js"),
		path.join(blogRoot, "scripts", "load-env.js"),
	);
	write(path.join(blogRoot, "package.json"), '{"type":"module"}\n');

	for (const directory of ["posts", "essays", "spec", "assets", "friends", "anime"]) {
		fs.mkdirSync(path.join(contentRoot, directory), { recursive: true });
	}
	const sentinelPath = path.join(blogRoot, "src", "content", "posts", "sentinel.md");
	write(sentinelPath, "keep me");

	const result = spawnSync(process.execPath, [scriptPath], {
		encoding: "utf8",
		env: {
			...isolatedEnv,
			CONTENT_DIR: path.relative(blogRoot, contentRoot),
		},
	});

	assert.equal(result.status, 1);
	assert.match(result.stderr, /required directory missing: site/);
	assert.equal(fs.readFileSync(sentinelPath, "utf8"), "keep me");

	const invalidBlogRoot = path.join(tmpRoot, "invalid-site-blog");
	const invalidContentRoot = path.join(tmpRoot, "invalid-site-content");
	const invalidScriptPath = installSyncScript(invalidBlogRoot);
	createRequiredDirectories(invalidContentRoot);
	writeRequiredSiteFiles(invalidContentRoot);
	write(path.join(invalidContentRoot, "site", "profile.json"), "{ invalid json");
	const invalidSentinel = path.join(
		invalidBlogRoot,
		"src",
		"generated",
		"obsidian-config.ts",
	);
	write(invalidSentinel, "keep generated config");

	const invalid = spawnSync(process.execPath, [invalidScriptPath], {
		encoding: "utf8",
		env: {
			...isolatedEnv,
			CONTENT_DIR: path.relative(invalidBlogRoot, invalidContentRoot),
		},
	});
	assert.equal(invalid.status, 1);
	assert.match(invalid.stderr, /site\/profile\.json parse failed/);
	assert.equal(fs.readFileSync(invalidSentinel, "utf8"), "keep generated config");

	const remoteMediaBlogRoot = path.join(tmpRoot, "missing-media-manifest-blog");
	const remoteMediaContentRoot = path.join(tmpRoot, "missing-media-manifest-content");
	const remoteMediaScriptPath = installSyncScript(remoteMediaBlogRoot);
	createRequiredDirectories(remoteMediaContentRoot);
	writeRequiredSiteFiles(remoteMediaContentRoot);
	const missingManifest = spawnSync(process.execPath, [remoteMediaScriptPath], {
		encoding: "utf8",
		env: {
			...isolatedEnv,
			CONTENT_DIR: path.relative(remoteMediaBlogRoot, remoteMediaContentRoot),
			BLOG_MEDIA_BASE_URL: "https://img.sayori.org/blog/v1",
			BLOG_MEDIA_MANIFEST: path.join(remoteMediaBlogRoot, "missing.json"),
		},
	});
	assert.equal(missingManifest.status, 1);
	assert.match(
		`${missingManifest.stdout}\n${missingManifest.stderr}`,
		/blog media manifest missing/i,
	);

	const brokenLinkBlogRoot = path.join(tmpRoot, "broken-link-blog");
	const brokenLinkContentRoot = path.join(tmpRoot, "broken-link-content");
	const brokenLinkScriptPath = installSyncScript(brokenLinkBlogRoot);
	createRequiredDirectories(brokenLinkContentRoot);
	writeRequiredSiteFiles(brokenLinkContentRoot);
	write(
		path.join(brokenLinkContentRoot, "posts", "broken", "broken.md"),
		"---\ntitle: Broken\n---\n\nSee [[Missing Public Page]].\n",
	);
	const brokenLink = spawnSync(process.execPath, [brokenLinkScriptPath], {
		encoding: "utf8",
		env: {
			...isolatedEnv,
			CONTENT_DIR: path.relative(brokenLinkBlogRoot, brokenLinkContentRoot),
		},
	});
	assert.equal(brokenLink.status, 1);
	assert.match(`${brokenLink.stdout}\n${brokenLink.stderr}`, /无法解析 \[\[Missing Public Page\]\]/);
} finally {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function installSyncScript(blogRoot) {
	const scriptPath = path.join(blogRoot, "scripts", "sync-content.js");
	fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
	fs.copyFileSync(path.join(scriptsRoot, "sync-content.js"), scriptPath);
	fs.copyFileSync(
		path.join(scriptsRoot, "load-env.js"),
		path.join(blogRoot, "scripts", "load-env.js"),
	);
	write(path.join(blogRoot, "package.json"), '{"type":"module"}\n');
	return scriptPath;
}

function createRequiredDirectories(contentRoot) {
	for (const directory of ["posts", "essays", "spec", "site", "assets", "friends", "anime"]) {
		fs.mkdirSync(path.join(contentRoot, directory), { recursive: true });
	}
}

function writeRequiredSiteFiles(contentRoot) {
	for (const filename of [
		"profile.json",
		"banner.json",
		"navigation.json",
		"announcement.json",
		"sponsor.json",
		"music.json",
	]) {
		write(path.join(contentRoot, "site", filename), "{}\n");
	}
	write(path.join(contentRoot, "site", "sponsor.md"), "---\ntitle: Sponsor\n---\n");
}

function write(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content, "utf8");
}
