export type SiteLocale = "zh-CN" | "zh-Hant" | "en";
export type HreflangLocale = "zh-Hans" | "zh-Hant" | "en";
export type HreflangMap = Partial<Record<HreflangLocale, string>>;

export const DEFAULT_SITE_LOCALE: SiteLocale = "zh-CN";
const buildLocale = String(import.meta.env.SITE_LANG || "zh_CN").toLowerCase();
export const SITE_LOCALE: SiteLocale = buildLocale.startsWith("en")
	? "en"
	: buildLocale === "zh_tw" || buildLocale === "zh-hant"
		? "zh-Hant"
		: DEFAULT_SITE_LOCALE;

export const isEnglishSite = SITE_LOCALE === "en";
export const isTraditionalSite = SITE_LOCALE === "zh-Hant";

export function stripLocalePrefix(pathname: string): string {
	const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
	for (const prefix of ["/zh-hant", "/en"]) {
		if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
			return normalized.slice(prefix.length) || "/";
		}
	}
	return normalized;
}

export function localizedPath(pathname: string, locale: SiteLocale): string {
	const normalized = stripLocalePrefix(pathname);
	if (locale === "en") {
		return normalized === "/" ? "/en/" : `/en${normalized}`;
	}
	if (locale === "zh-Hant") {
		return normalized === "/" ? "/zh-hant/" : `/zh-hant${normalized}`;
	}
	return normalized;
}

export function currentLocalePath(pathname: string): string {
	return localizedPath(stripLocalePrefix(pathname), SITE_LOCALE);
}

export function alternateLocale(): SiteLocale {
	return isEnglishSite ? DEFAULT_SITE_LOCALE : "en";
}
