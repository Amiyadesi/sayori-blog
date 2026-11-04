import type { OwnPost } from '../src/data/p34-own-posts';
export const HER_OWN_POSTS: OwnPost[];
export function normalizeBlogPath(pathname?: string): string;
export function getOwnPostBySlug(slug?: string): OwnPost | null;
export function getOwnPostByPath(pathname?: string): OwnPost | null;
export function isOwnNotePath(pathname?: string): boolean;
