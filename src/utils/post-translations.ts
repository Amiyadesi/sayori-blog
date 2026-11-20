import type { CollectionEntry } from "astro:content";

import type { SiteLocale } from "./site-locale";
import { getBuildLocale } from "./blog-locales.mjs";

type TranslationPost = Pick<CollectionEntry<"posts">, "id" | "data">;

export function getPostLocale(value?: string | null): SiteLocale {
	return getBuildLocale(value?.trim()).id;
}

/**
 * Only an explicit translationKey groups posts. Similar titles or slugs are
 * not enough evidence that two pages are complete translations of each other.
 */
export function getPostTranslationEntries(
	post: TranslationPost,
	candidates: TranslationPost[],
): Map<SiteLocale, TranslationPost> {
	const key = String(post.data.translationKey || "").trim();
	if (!key) {
		return new Map([[getPostLocale(post.data.lang), post]]);
	}

	const matches = candidates.filter(
		(candidate) =>
			String(candidate.data.translationKey || "").trim() === key &&
			candidate.data.draft !== true &&
			candidate.data.encrypted !== true,
	);
	const variants = new Map<SiteLocale, TranslationPost>();

	for (const candidate of matches) {
		const locale = getPostLocale(candidate.data.lang);
		if (candidate.id === post.id || !variants.has(locale)) {
			variants.set(locale, candidate);
		}
	}
	if (!variants.has(getPostLocale(post.data.lang))) {
		variants.set(getPostLocale(post.data.lang), post);
	}
	return variants;
}
