import { blogLocales, extraLocales, getBuildLocale } from "./blog-locales.mjs";

export type SiteLocale = (typeof blogLocales)[number]["id"];
export type HreflangLocale = (typeof blogLocales)[number]["hreflang"];
export type HreflangMap = Partial<Record<HreflangLocale, string>>;

export const DEFAULT_SITE_LOCALE: SiteLocale = "zh-CN";
export const SITE_LOCALE = getBuildLocale(import.meta.env.SITE_LANG).id;
export const isEnglishSite = SITE_LOCALE === "en";
export const isTraditionalSite = SITE_LOCALE === "zh-Hant";
export const isExtraLocale = extraLocales.some(({ id }) => id === SITE_LOCALE);

export function stripLocalePrefix(pathname: string): string {
	const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
	const first = normalized.split("/")[1];
	return first && blogLocales.some(({ base }) => base === first)
		? normalized.slice(first.length + 1) || "/"
		: normalized;
}

export function localizedPath(pathname: string, locale: SiteLocale): string {
	const normalized = stripLocalePrefix(pathname);
	const base = blogLocales.find(({ id }) => id === locale)?.base;
	return base ? `/${base}${normalized}` : normalized;
}

export function currentLocalePath(pathname: string): string {
	return localizedPath(pathname, SITE_LOCALE);
}

export function alternateLocale(): SiteLocale {
	return isEnglishSite ? DEFAULT_SITE_LOCALE : "en";
}
