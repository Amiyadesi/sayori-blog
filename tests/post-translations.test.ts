import assert from "node:assert/strict";
import test from "node:test";

import {
	getPostLocale,
	getPostTranslationEntries,
} from "../src/utils/post-translations";

function post(id: string, lang: string, translationKey = "", extra = {}) {
	return {
		id,
		data: { lang, translationKey, ...extra },
	} as never;
}

test("post languages normalize to the three public site locales", () => {
	assert.equal(getPostLocale("en-US"), "en");
	assert.equal(getPostLocale("zh_TW"), "zh-Hant");
	assert.equal(getPostLocale("zh-Hant"), "zh-Hant");
	assert.equal(getPostLocale("zh-Hans"), "zh-CN");
	assert.equal(getPostLocale(""), "zh-CN");
});

test("only an explicit translationKey links language variants", () => {
	const chinese = post("time-puzzle.md", "zh-Hans");
	const similarlyNamedEnglish = post("time-puzzle.en.md", "en");
	const variants = getPostTranslationEntries(chinese, [chinese, similarlyNamedEnglish]);
	assert.deepEqual([...variants.keys()], ["zh-CN"]);
});

test("translation alternates include published, unencrypted variants sharing the key", () => {
	const chinese = post("rewind.md", "zh-Hans", "rewind-post");
	const traditional = post("rewind.zh-hant.md", "zh-Hant", "rewind-post");
	const english = post("rewind.en.md", "en", "rewind-post");
	const draft = post("rewind.draft.md", "en", "rewind-post", { draft: true });
	const encrypted = post("rewind.locked.md", "zh-Hant", "rewind-post", { encrypted: true });

	const variants = getPostTranslationEntries(
		chinese,
		[chinese, traditional, english, draft, encrypted],
	);
	assert.deepEqual([...variants.keys()], ["zh-CN", "zh-Hant", "en"]);
	assert.equal(variants.get("zh-Hant")?.id, "rewind.zh-hant.md");
	assert.equal(variants.get("en")?.id, "rewind.en.md");
});

test("a current post remains its own fallback if the candidate list omits it", () => {
	const english = post("notes.en.md", "en", "notes");
	const variants = getPostTranslationEntries(english, []);
	assert.equal(variants.get("en")?.id, "notes.en.md");
});
