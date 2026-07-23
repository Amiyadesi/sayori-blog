import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadEnv } from "./load-env.js";
import {
	findMissingRemoteObjects,
	prepareBlogMedia,
	verifyRemoteManifest,
} from "./blog-media.mjs";

const scriptFile = fileURLToPath(import.meta.url);
const blogRoot = path.resolve(path.dirname(scriptFile), "..");
loadEnv();

const baseUrl = String(process.env.BLOG_MEDIA_BASE_URL || "").trim();
const required = process.env.BLOG_MEDIA_REQUIRED === "true";
if (!baseUrl) {
	if (required) {
		throw new Error(
			"BLOG_MEDIA_BASE_URL is required for a production media build",
		);
	}
	console.log(
		"[blog-media] BLOG_MEDIA_BASE_URL is not set; keeping local image mode",
	);
	process.exit(0);
}

const contentDir = path.resolve(
	blogRoot,
	String(process.env.CONTENT_DIR || path.join("..", "sayori-articles")),
);
const outputDir = path.resolve(
	blogRoot,
	String(
		process.env.BLOG_MEDIA_OUTPUT_DIR || path.join(".cache", "blog-media"),
	),
);
const result = await prepareBlogMedia({ contentDir, outputDir, baseUrl });
console.log(`[blog-media] manifest: ${result.manifestPath}`);

if (process.env.BLOG_MEDIA_UPLOAD === "true") {
	await uploadObjects(result.objects);
}

if (
	process.env.BLOG_MEDIA_VERIFY_REMOTE === "true" ||
	process.env.BLOG_MEDIA_UPLOAD === "true"
) {
	await verifyRemoteManifest(result.manifest);
}

async function uploadObjects(objects) {
	if (!process.env.BLOG_MEDIA_CF_API_TOKEN) {
		throw new Error(
			"BLOG_MEDIA_CF_API_TOKEN is required when BLOG_MEDIA_UPLOAD=true",
		);
	}
	if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
		throw new Error(
			"CLOUDFLARE_ACCOUNT_ID is required when BLOG_MEDIA_UPLOAD=true",
		);
	}

	const missingObjects = await findMissingRemoteObjects(objects);
	console.log(
		`[blog-media] remote objects: ${objects.length - missingObjects.length} present, ${missingObjects.length} missing`,
	);
	if (!missingObjects.length) return;

	const version = process.env.WRANGLER_VERSION || "4.111.0";
	const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
	let completed = 0;
	await runPool(missingObjects, 4, async (object) => {
		await runCommand(
			command,
			[
				"dlx",
				`wrangler@${version}`,
				"r2",
				"object",
				"put",
				`sayori-media/${object.objectKey}`,
				"--file",
				object.filePath,
				"--content-type",
				object.contentType,
				"--cache-control",
				"public, max-age=31536000, immutable",
				"--remote",
			],
			{
				...process.env,
				CLOUDFLARE_API_TOKEN: process.env.BLOG_MEDIA_CF_API_TOKEN,
			},
		);
		completed += 1;
		console.log(
			`[blog-media] uploaded ${completed}/${missingObjects.length}`,
		);
	});
}

function runCommand(command, args, env) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: blogRoot,
			env,
			stdio: "inherit",
			windowsHide: true,
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) return resolve();
			reject(
				new Error(
					`Command failed (${code ?? signal}): ${command} ${args.join(" ")}`,
				),
			);
		});
	});
}

async function runPool(items, concurrency, worker) {
	let cursor = 0;
	async function consume() {
		while (cursor < items.length) {
			const item = items[cursor++];
			await worker(item);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, consume),
	);
}
