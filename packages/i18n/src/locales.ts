export const SUPPORTED_LOCALES = ["en-US", "ro-RO"] as const;

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

export const LOCALE_LABELS: Record<AppLocale, string> = {
	"en-US": "English (US)",
	"ro-RO": "Română",
};

export function isAppLocale(value: unknown): value is AppLocale {
	return (
		typeof value === "string" &&
		(SUPPORTED_LOCALES as readonly string[]).includes(value)
	);
}

/**
 * Resolve the best supported locale from browser language tags.
 * Prefers exact matches (en-US), then language-only (en → en-US, ro → ro-RO).
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
		if (language === "en") {
			return "en-US";
		}
		if (language === "ro") {
			return "ro-RO";
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
