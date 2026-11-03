import {
	HER_OWN_POSTS as CANONICAL_OWN_POSTS,
	getOwnPostByPath,
	getOwnPostBySlug,
	isOwnNotePath,
	normalizeBlogPath,
} from "../../public/p34-own-posts.js";

export interface OwnPostSection {
	heading: string | null;
	paragraphs: string[];
}

export interface OwnPost {
	id: string;
	slug: string;
	path: string;
	href: string;
	date: string;
	kicker: string;
	title: string;
	excerpt: string;
	lead: string;
	voiceRemark: string;
	sections: OwnPostSection[];
	paragraphs: string[];
}

export const HER_OWN_POSTS: OwnPost[] = CANONICAL_OWN_POSTS;
export {
	normalizeBlogPath,
	getOwnPostBySlug,
	getOwnPostByPath,
	isOwnNotePath,
};
