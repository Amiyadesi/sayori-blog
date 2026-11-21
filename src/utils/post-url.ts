import type { CollectionEntry } from "astro:content";

import { permalinkConfig } from "../config";
import { hasCustomPermalink, initPostIdMap } from "./permalink-utils";
import { removeFileExtension } from "./url-utils";

function normalizePostAlias(alias: string): string {
	const normalized = alias.replace(/^\/+/, "").replace(/\/+$/, "");
	return normalized.startsWith("posts/")
		? normalized.replace(/^posts\//, "")
		: normalized;
}

export function buildPostPaths(blogEntries: CollectionEntry<"posts">[], canonicalOnly = false) {
	initPostIdMap(blogEntries);

	return blogEntries
		.map((entry) => {
			const defaultSlug = removeFileExtension(entry.id);

			if (hasCustomPermalink(entry)) {
				return [{ params: { slug: defaultSlug }, props: { entry } }];
			}

			if (permalinkConfig.enable) {
				return [{ params: { slug: defaultSlug }, props: { entry } }];
			}

			const alias = entry.data.alias ? normalizePostAlias(entry.data.alias) : "";
			const canonical = { params: { slug: alias || defaultSlug }, props: { entry } };
			// The new reading editions have no published pre-alias routes to preserve.
			return canonicalOnly || !alias || alias === defaultSlug
				? [canonical]
				: [{ params: { slug: defaultSlug }, props: { entry } }, canonical];
		})
		.flat();
}
