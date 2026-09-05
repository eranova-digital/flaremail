import {
	DEFAULT_LOCALE,
	isAppLocale,
	type AppLocale,
} from "@flaremail/i18n";
import {
	de,
	enUS,
	es,
	fr,
	it,
	ja,
	ko,
	pl,
	ptBR,
	ro,
	ru,
	tr,
	zhCN,
	type Locale,
} from "date-fns/locale";

const DATE_FNS_LOCALES: Record<AppLocale, Locale> = {
	"en-US": enUS,
	"ro-RO": ro,
	"es-ES": es,
	"de-DE": de,
	"fr-FR": fr,
	"pt-BR": ptBR,
	"it-IT": it,
	"pl-PL": pl,
	"tr-TR": tr,
	"ja-JP": ja,
	"ko-KR": ko,
	"zh-CN": zhCN,
	"ru-RU": ru,
};

export function dateFnsLocaleFor(language: string): Locale {
	return DATE_FNS_LOCALES[isAppLocale(language) ? language : DEFAULT_LOCALE];
}

export function formatDateTime(
	value: Date | string,
	language: string,
	options: Intl.DateTimeFormatOptions,
): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return typeof value === "string" ? value : "";
	}
	return new Intl.DateTimeFormat(
		isAppLocale(language) ? language : DEFAULT_LOCALE,
		options,
	).format(date);
}

export function formatLogTimestamp(iso: string, language: string): string {
	try {
		return formatDateTime(iso, language, {
			dateStyle: "medium",
			timeStyle: "medium",
		});
	} catch {
		return iso;
	}
}
