import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { getPublishedTopicForPost } from "../src/data/topics";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("topic-aware reading path", () => {
	it("only associates posts declared by a published source topic", () => {
		assert.equal(
			getPublishedTopicForPost("astro-mizuki-blog-from-zero")?.slug,
			"webmaster",
		);
		assert.equal(getPublishedTopicForPost("godot-useful-plugins"), undefined);
	});

	it("replaces generic related-post selection on article pages", () => {
		const page = read("src/pages/posts/[...slug].astro");
		assert.match(page, /TopicReadingPath/);
		assert.doesNotMatch(page, /getRelatedPosts|<RelatedPosts/);
	});
});
