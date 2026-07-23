import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
	buildManifestIndex,
	buildVariantWidths,
	findMissingRemoteObjects,
	prepareBlogMedia,
	resolveManifestAsset,
	verifyRemoteManifest,
} from "./blog-media.mjs";

test("responsive widths never upscale and keep the largest source width", () => {
	assert.deepEqual(buildVariantWidths(320), [320]);
	assert.deepEqual(buildVariantWidths(1000), [640, 1000]);
	assert.deepEqual(buildVariantWidths(1600), [640, 1280, 1600]);
	assert.deepEqual(buildVariantWidths(2400), [640, 1280, 1920]);
});

test("manifest lookup resolves public paths, source URLs and generated URLs", () => {
	const asset = {
		source: {
			kind: "local",
			path: "posts/example/example.png",
			publicPath: "/images/posts/example/example.png",
		},
		width: 1200,
		height: 600,
		primaryUrl: `https://img.sayori.org/blog/v1/${"a".repeat(64)}/1200.webp`,
		variants: [
			{
				width: 640,
				height: 320,
				url: `https://img.sayori.org/blog/v1/${"a".repeat(64)}/640.webp`,
			},
		],
	};
	const remote = {
		...asset,
		source: { kind: "remote", url: "https://cdn.example/image.png" },
	};
	const index = buildManifestIndex({ version: 1, assets: [asset, remote] });

	assert.equal(resolveManifestAsset(index, asset.source.publicPath), asset);
	assert.equal(resolveManifestAsset(index, remote.source.url), remote);
	assert.equal(resolveManifestAsset(index, asset.primaryUrl), asset);
	assert.equal(resolveManifestAsset(index, "/missing.png"), null);
});

test("prepareBlogMedia uses actual dimensions and preserves animations", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sayori-blog-media-"));
	const contentDir = path.join(root, "content");
	const outputDir = path.join(root, "output");
	const postDir = path.join(contentDir, "posts", "example");
	fs.mkdirSync(postDir, { recursive: true });

	try {
		fs.writeFileSync(
			path.join(postDir, "example.md"),
			"---\ntitle: Example\n---\n\n![[screenshot.png]]\n![[animation.gif]]\n![[animation.webp]]\n",
		);
		await sharp({
			create: {
				width: 1280,
				height: 825,
				channels: 4,
				background: { r: 20, g: 80, b: 120, alpha: 1 },
			},
		})
			.png()
			.toFile(path.join(postDir, "screenshot.png"));
		const gifBytes = Buffer.from(
			"R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
			"base64",
		);
		fs.writeFileSync(path.join(postDir, "animation.gif"), gifBytes);
		const frameWidth = 12;
		const frameHeight = 4;
		const redFrame = Buffer.alloc(frameWidth * frameHeight * 4);
		const blueFrame = Buffer.alloc(frameWidth * frameHeight * 4);
		for (let index = 0; index < redFrame.length; index += 4) {
			redFrame[index] = 255;
			redFrame[index + 3] = 255;
			blueFrame[index + 2] = 255;
			blueFrame[index + 3] = 255;
		}
		await sharp(Buffer.concat([redFrame, blueFrame]), {
			raw: {
				width: frameWidth,
				height: frameHeight * 2,
				channels: 4,
				pageHeight: frameHeight,
			},
		})
			.webp({ delay: [50, 50], loop: 0 })
			.toFile(path.join(postDir, "animation.webp"));

		const result = await prepareBlogMedia({
			contentDir,
			outputDir,
			baseUrl: "https://img.sayori.org/blog/v1",
			remotePostSlugs: [],
		});

		assert.equal(result.manifest.assets.length, 3);
		const pngAsset = result.manifest.assets.find((item) =>
			item.source.path.endsWith("screenshot.png"),
		);
		assert.deepEqual(
			pngAsset.variants.map((item) => item.width),
			[640, 1280],
		);
		assert.match(pngAsset.primaryUrl, /\/1280\.webp$/);
		assert.equal(pngAsset.width, 1280);
		assert.equal(pngAsset.height, 825);
		assert.ok(pngAsset.sourceByteLength > 0);
		assert.ok(pngAsset.variants.every((item) => item.byteLength > 0));
		assert.ok(
			fs.existsSync(
				path.join(outputDir, "objects", pngAsset.hash, "640.webp"),
			),
		);

		const gifAsset = result.manifest.assets.find((item) =>
			item.source.path.endsWith("animation.gif"),
		);
		assert.match(gifAsset.primaryUrl, /\/original\.gif$/);
		assert.deepEqual(
			fs.readFileSync(
				path.join(outputDir, "objects", gifAsset.hash, "original.gif"),
			),
			gifBytes,
		);

		const webpAsset = result.manifest.assets.find((item) =>
			item.source.path.endsWith("animation.webp"),
		);
		assert.equal(webpAsset.width, frameWidth);
		assert.equal(webpAsset.height, frameHeight);
		assert.equal(webpAsset.variants[0].height, frameHeight);
		const webpMetadata = await sharp(
			fs.readFileSync(
				path.join(
					outputDir,
					"objects",
					webpAsset.hash,
					`${frameWidth}.webp`,
				),
			),
			{ animated: true },
		).metadata();
		assert.equal(webpMetadata.pages, 2);
		assert.equal(webpMetadata.pageHeight, frameHeight);

		for (const variant of pngAsset.variants) {
			const metadata = await sharp(
				fs.readFileSync(
					path.join(
						outputDir,
						"objects",
						pngAsset.hash,
						`${variant.width}.webp`,
					),
				),
			).metadata();
			assert.equal(variant.width, metadata.width);
			assert.equal(variant.height, metadata.height);
		}
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("remote object lookup uploads only 404 objects and verifies byte lengths", async () => {
	const present = {
		url: "https://img.sayori.org/blog/v1/present/640.webp",
		byteLength: 12,
	};
	const missing = {
		url: "https://img.sayori.org/blog/v1/missing/640.webp",
		byteLength: 20,
	};
	const fetchImpl = async (url, options) => {
		assert.equal(options.method, "HEAD");
		if (url === missing.url) return new Response(null, { status: 404 });
		return new Response(null, {
			status: 200,
			headers: {
				"Content-Type": "image/webp",
				"Content-Length": "12",
			},
		});
	};

	assert.deepEqual(
		await findMissingRemoteObjects([present, missing], {
			fetchImpl,
			concurrency: 2,
		}),
		[missing],
	);

	await verifyRemoteManifest(
		{
			assets: [{ variants: [{ ...present, width: 640, height: 320 }] }],
		},
		{ fetchImpl },
	);
});

test("remote verification rejects an object with unexpected bytes", async () => {
	const target = {
		url: "https://img.sayori.org/blog/v1/bad/640.webp",
		byteLength: 12,
	};
	const fetchImpl = async () =>
		new Response(null, {
			status: 200,
			headers: {
				"Content-Type": "image/webp",
				"Content-Length": "11",
			},
		});

	await assert.rejects(
		findMissingRemoteObjects([target], { fetchImpl }),
		/content-length 11 != 12/,
	);
	await assert.rejects(
		verifyRemoteManifest(
			{ assets: [{ variants: [target] }] },
			{ fetchImpl },
		),
		/content-length 11 != 12/,
	);
});
