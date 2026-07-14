import type { Page } from "astro";
import type { CollectionEntry } from "astro:content";

export interface PostCardProps {
	class?: string;
	entry: CollectionEntry<"posts">;
	style?: string;
}

export interface PostMetaProps {
	published: Date;
	updated?: Date;
	category?: string;
	tags?: string[];
	hideUpdateDate?: boolean;
	hideTagsForMobile?: boolean;
	isHome?: boolean;
	className?: string;
	id?: string;
	showOnlyBasicMeta?: boolean;
	words?: number;
	minutes?: number;
	showWordCount?: boolean;
	showReadingTime?: boolean;
	showEncrypted?: boolean;
	createdDate?: Date;
	lastEditedDate?: Date;
	updateCount?: number;
}

export interface PostPageProps {
	page: Page<CollectionEntry<"posts">>;
}
