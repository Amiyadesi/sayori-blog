import assert from "node:assert/strict";
import test from "node:test";

import { rehypeBlogMedia } from "../src/plugins/rehype-blog-media.mjs";

test("content images receive responsive CDN attributes", () => {
	const hash = "a".repeat(64);
	const source = "/images/posts/example/screenshot.png";
	const image = {
		type: "element",
		tagName: "img",
		properties: { alt: "Screenshot", src: source },
		children: [],
	};
	const tree = { type: "root", children: [image] };

	rehypeBlogMedia({
		manifest: {
			version: 1,
			assets: [
				{
					source: { kind: "local", publicPath: source },
					width: 1280,
					height: 720,
					primaryUrl: `https://img.sayori.org/blog/v1/${hash}/1280.webp`,
					variants: [
						{
							width: 640,
							height: 360,
							url: `https://img.sayori.org/blog/v1/${hash}/640.webp`,
						},
						{
							width: 1280,
							height: 720,
							url: `https://img.sayori.org/blog/v1/${hash}/1280.webp`,
						},
					],
				},
			],
		},
	})(tree);

	assert.equal(
		image.properties.src,
		`https://img.sayori.org/blog/v1/${hash}/1280.webp`,
	);
	assert.equal(
		image.properties.srcSet,
		`https://img.sayori.org/blog/v1/${hash}/640.webp 640w, https://img.sayori.org/blog/v1/${hash}/1280.webp 1280w`,
	);
	assert.equal(image.properties.sizes, "(max-width: 768px) 100vw, 46rem");
	assert.equal(image.properties.width, 1280);
	assert.equal(image.properties.height, 720);
	assert.equal(image.properties.loading, "lazy");
	assert.equal(image.properties.decoding, "async");
});

test("CDN images replace upstream animation stack dimensions", () => {
	const hash = "b".repeat(64);
	const source = "https://cdn.example.com/animated.webp";
	const image = {
		type: "element",
		tagName: "img",
		properties: {
			alt: "Animated screenshot",
			src: source,
			width: 323,
			height: 118332,
		},
		children: [],
	};
	const tree = { type: "root", children: [image] };

	rehypeBlogMedia({
		manifest: {
			version: 1,
			assets: [
				{
					source: { kind: "remote", url: source },
					width: 323,
					height: 692,
					primaryUrl: `https://img.sayori.org/blog/v1/${hash}/323.webp`,
					variants: [
						{
							width: 323,
							height: 692,
							url: `https://img.sayori.org/blog/v1/${hash}/323.webp`,
						},
					],
				},
			],
		},
	})(tree);

	assert.equal(image.properties.width, 323);
	assert.equal(image.properties.height, 692);
});

test("content images still receive lazy decoding without a remote manifest", () => {
	const image = {
		type: "element",
		tagName: "img",
		properties: { alt: "Local", src: "/images/local.png" },
		children: [],
	};
	rehypeBlogMedia({ manifest: null })({ type: "root", children: [image] });
	assert.equal(image.properties.src, "/images/local.png");
	assert.equal(image.properties.loading, "lazy");
	assert.equal(image.properties.decoding, "async");
});
