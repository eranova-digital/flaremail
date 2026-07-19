export const SUPPORTED_LOCALES = [
	"en-US",
	"ro-RO",
	"es-ES",
	"de-DE",
	"fr-FR",
	"pt-BR",
	"it-IT",
	"pl-PL",
	"tr-TR",
	"ja-JP",
	"ko-KR",
	"zh-CN",
	"ru-RU",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en-US";

export const LOCALE_STORAGE_KEY = "flaremail:locale";

export const I18N_NAMESPACES = [
	"common",
	"errors",
	"auth",
	"mail",
	"compose",
	"settings",
	"management",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

/** Native-language labels for the preferences language switcher. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
	"en-US": "English (US)",
	"ro-RO": "Română",
	"es-ES": "Español",
	"de-DE": "Deutsch",
	"fr-FR": "Français",
	"pt-BR": "Português (Brasil)",
	"it-IT": "Italiano",
	"pl-PL": "Polski",
	"tr-TR": "Türkçe",
	"ja-JP": "日本語",
	"ko-KR": "한국어",
	"zh-CN": "简体中文",
	"ru-RU": "Русский",
};

/** Regional flags shown next to locale labels in the language switcher. */
export const LOCALE_FLAGS: Record<AppLocale, string> = {
	"en-US": "🇺🇸",
	"ro-RO": "🇷🇴",
	"es-ES": "🇪🇸",
	"de-DE": "🇩🇪",
	"fr-FR": "🇫🇷",
	"pt-BR": "🇧🇷",
	"it-IT": "🇮🇹",
	"pl-PL": "🇵🇱",
	"tr-TR": "🇹🇷",
	"ja-JP": "🇯🇵",
	"ko-KR": "🇰🇷",
	"zh-CN": "🇨🇳",
	"ru-RU": "🇷🇺",
};

/** Map BCP 47 primary language subtags to a supported AppLocale. */
export const LANGUAGE_TO_LOCALE: Record<string, AppLocale> = {
	en: "en-US",
	ro: "ro-RO",
	es: "es-ES",
	de: "de-DE",
	fr: "fr-FR",
	pt: "pt-BR",
	it: "it-IT",
	pl: "pl-PL",
	tr: "tr-TR",
	ja: "ja-JP",
	ko: "ko-KR",
	zh: "zh-CN",
	ru: "ru-RU",
};

export function isAppLocale(value: unknown): value is AppLocale {
	return (
		typeof value === "string" &&
		(SUPPORTED_LOCALES as readonly string[]).includes(value)
	);
}

/**
 * Resolve the best supported locale from browser language tags.
 * Prefers exact matches (en-US), then language-only (de → de-DE).
 */
export function detectLocaleFromLanguages(
	languages: readonly string[],
	fallback: AppLocale = DEFAULT_LOCALE,
): AppLocale {
	const normalized = languages
		.map((tag) => tag.trim())
		.filter(Boolean)
		.map((tag) => tag.replace(/_/g, "-"));

	for (const tag of normalized) {
		if (isAppLocale(tag)) {
			return tag;
		}
	}

	for (const tag of normalized) {
		const language = tag.split("-")[0]?.toLowerCase();
		if (language && language in LANGUAGE_TO_LOCALE) {
			return LANGUAGE_TO_LOCALE[language]!;
		}
	}

	return fallback;
}

export function getStoredLocale(): AppLocale | null {
	try {
		const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
		if (isAppLocale(raw)) {
			return raw;
		}
	} catch {
		// ignore quota / private mode
	}
	return null;
}

export function setStoredLocale(locale: AppLocale): void {
	try {
		localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	} catch {
		// ignore quota / private mode
	}
}

export function resolveInitialLocale(
	languages: readonly string[] = typeof navigator !== "undefined"
		? navigator.languages
		: [],
): AppLocale {
	return getStoredLocale() ?? detectLocaleFromLanguages(languages);
}
