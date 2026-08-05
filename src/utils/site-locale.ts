export type SiteLocale = "zh-CN" | "en";

export const DEFAULT_SITE_LOCALE: SiteLocale = "zh-CN";
export const SITE_LOCALE: SiteLocale =
	String(import.meta.env.SITE_LANG || "zh_CN").toLowerCase().startsWith("en")
		? "en"
		: DEFAULT_SITE_LOCALE;

export const isEnglishSite = SITE_LOCALE === "en";

export function stripLocalePrefix(pathname: string): string {
	const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return normalized === "/en" || normalized.startsWith("/en/")
		? normalized.slice(3) || "/"
		: normalized;
}

export function localizedPath(pathname: string, locale: SiteLocale): string {
	const normalized = stripLocalePrefix(pathname);
	if (locale === "en") {
		return normalized === "/" ? "/en/" : `/en${normalized}`;
	}
	return normalized;
}

export function currentLocalePath(pathname: string): string {
	return localizedPath(stripLocalePrefix(pathname), SITE_LOCALE);
}

export function alternateLocale(): SiteLocale {
	return isEnglishSite ? DEFAULT_SITE_LOCALE : "en";
}
