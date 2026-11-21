import { siteConfig } from "../config";
import I18nKey from "./i18nKey";
import { en } from "./languages/en";
import { ja } from "./languages/ja";
import { zh_CN } from "./languages/zh_CN";
import { zh_TW } from "./languages/zh_TW";

export type Translation = Record<I18nKey, string>;

const defaultTranslation = en;

function readingTranslation(toc: string, related: string, word: string, words: string, minute: string, minutes: string): Translation {
	return {
		...en,
		[I18nKey.tableOfContents]: toc,
		[I18nKey.relatedPosts]: related,
		[I18nKey.wordCount]: word,
		[I18nKey.wordsCount]: words,
		[I18nKey.minuteCount]: minute,
		[I18nKey.minutesCount]: minutes,
	};
}

const map: Record<string, Translation> = {
	en: en,
	en_us: en,
	en_gb: en,
	en_au: en,
	zh_cn: zh_CN,
	zh_tw: zh_TW,
	ja: ja,
	ja_jp: ja,
	fr: readingTranslation("Sommaire", "Articles associés", "mot", "mots", "minute", "minutes"),
	ko: readingTranslation("목차", "관련 글", "단어", "단어", "분", "분"),
	es: readingTranslation("Índice", "Artículos relacionados", "palabra", "palabras", "minuto", "minutos"),
	de: readingTranslation("Inhaltsverzeichnis", "Ähnliche Beiträge", "Wort", "Wörter", "Minute", "Minuten"),
	"pt-br": readingTranslation("Sumário", "Artigos relacionados", "palavra", "palavras", "minuto", "minutos"),
};

export function getTranslation(lang: string): Translation {
	return map[lang.toLowerCase()] || defaultTranslation;
}

export function i18n(key: I18nKey): string {
	const lang = siteConfig.lang || "en";
	return getTranslation(lang)[key];
}
