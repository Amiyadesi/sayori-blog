// The first three editions keep their existing URLs and full-site builds.
export const coreLocales = /** @type {const} */ ([
	{ id: "zh-CN", name: "简体中文", hreflang: "zh-Hans", base: "", build: "zh_CN" },
	{ id: "zh-Hant", name: "繁體中文", hreflang: "zh-Hant", base: "zh-hant", build: "zh_TW" },
	{ id: "en", name: "English", hreflang: "en", base: "en", build: "en" },
]);

export const extraLocales = /** @type {const} */ ([
	{ id: "ja", name: "日本語", hreflang: "ja", base: "ja", build: "ja" },
	{ id: "fr", name: "Français", hreflang: "fr", base: "fr", build: "fr" },
	{ id: "ko", name: "한국어", hreflang: "ko", base: "ko", build: "ko" },
	{ id: "es", name: "Español", hreflang: "es", base: "es", build: "es" },
	{ id: "de", name: "Deutsch", hreflang: "de", base: "de", build: "de" },
	{ id: "pt-BR", name: "Português (Brasil)", hreflang: "pt-BR", base: "pt-br", build: "pt-br" },
]);

export const blogLocales = [...coreLocales, ...extraLocales];

export const localizedReadingRoutes = ["/", "/archive/", "/essays/", "/privacy/"];
export const localePrefix = new RegExp(`^/(?:${blogLocales.map(({ base }) => base).filter(Boolean).join("|")})(?=/|$)`);

export function getBuildLocale(value = "") {
	const normalized = value.toLowerCase().replaceAll("_", "-");
	if (normalized === "zh-tw" || normalized === "zh-hk" || normalized.startsWith("zh-hant")) return coreLocales[1];
	if (normalized === "en" || normalized.startsWith("en-")) return coreLocales[2];
	return blogLocales.find(({ base }) => base === normalized) || coreLocales[0];
}

export const localizedFileSuffix = new RegExp(
	`\\.(${blogLocales.map(({ base }) => base).filter(Boolean).join("|")})(?=\\.(?:mdx?|json)$)`,
	"i",
);
