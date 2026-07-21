import assert from "node:assert/strict";
import test from "node:test";

import { rehypeImageWidth } from "../src/plugins/rehype-image-width.mjs";

test("percentage image styling preserves intrinsic dimensions", () => {
	const image = {
		type: "element",
		tagName: "img",
		properties: {
			alt: "Architecture diagram w-60%",
			src: "/images/diagram.webp",
			width: 800,
			height: 600,
			srcSet: "/images/diagram-400.webp 400w, /images/diagram.webp 800w",
			sizes: "(max-width: 768px) 100vw, 60vw",
		},
		children: [],
	};
	const tree = { type: "root", children: [image] };

	rehypeImageWidth()(tree);

	const wrappedImage = tree.children[0].children[0];
	assert.equal(wrappedImage.properties.width, 800);
	assert.equal(wrappedImage.properties.height, 600);
	assert.equal(wrappedImage.properties.srcSet, image.properties.srcSet);
	assert.equal(wrappedImage.properties.sizes, image.properties.sizes);
	assert.equal(wrappedImage.properties.alt, "Architecture diagram");
});
