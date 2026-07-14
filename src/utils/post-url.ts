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

export function buildPostPaths(blogEntries: CollectionEntry<"posts">[]) {
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

			const paths: {
				params: { slug: string };
				props: { entry: CollectionEntry<"posts"> };
			}[] = [{ params: { slug: defaultSlug }, props: { entry } }];

			if (entry.data.alias) {
				const alias = normalizePostAlias(entry.data.alias);
				if (alias && alias !== defaultSlug) {
					paths.push({ params: { slug: alias }, props: { entry } });
				}
			}

			return paths;
		})
		.flat();
}
