import {
	DEFAULT_LOCALE,
	LANGUAGE_TO_LOCALE,
	LOCALE_STORAGE_KEY,
	SUPPORTED_LOCALES,
	detectLocaleFromLanguages,
	isAppLocale,
	resolveInitialLocale,
	type AppLocale,
} from "@flaremail/i18n";
import { describe, expect, it } from "vitest";

describe("locale resolution", () => {
	it("detects exact locale tags", () => {
		expect(detectLocaleFromLanguages(["ro-RO", "en"])).toBe("ro-RO");
		expect(detectLocaleFromLanguages(["en-US"])).toBe("en-US");
		expect(detectLocaleFromLanguages(["ja-JP"])).toBe("ja-JP");
		expect(detectLocaleFromLanguages(["zh-CN"])).toBe("zh-CN");
	});

	it("falls back from language-only tags", () => {
		expect(detectLocaleFromLanguages(["ro"])).toBe("ro-RO");
		expect(detectLocaleFromLanguages(["en-GB"])).toBe("en-US");
		expect(detectLocaleFromLanguages(["de"])).toBe("de-DE");
		expect(detectLocaleFromLanguages(["pt-PT"])).toBe("pt-BR");
		expect(detectLocaleFromLanguages(["zh-TW"])).toBe("zh-CN");
	});

	it("uses default when nothing matches", () => {
		expect(detectLocaleFromLanguages(["sv-SE", "nl"])).toBe(DEFAULT_LOCALE);
	});

	it("validates supported locales", () => {
		expect(isAppLocale("en-US")).toBe(true);
		expect(isAppLocale("ro-RO")).toBe(true);
		expect(isAppLocale("de-DE")).toBe(true);
		expect(isAppLocale("zh-CN")).toBe(true);
		expect(isAppLocale("sv-SE")).toBe(false);
		expect(SUPPORTED_LOCALES).toContain("en-US");
		expect(SUPPORTED_LOCALES).toContain("ru-RU");
		expect(Object.keys(LANGUAGE_TO_LOCALE).length).toBeGreaterThan(10);
	});

	it("resolveInitialLocale prefers browser when storage empty", () => {
		const original = globalThis.localStorage;
		const store = new Map<string, string>();
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: {
				getItem: (key: string) => store.get(key) ?? null,
				setItem: (key: string, value: string) => {
					store.set(key, value);
				},
				removeItem: (key: string) => {
					store.delete(key);
				},
			},
		});

		try {
			expect(resolveInitialLocale(["ro-RO"])).toBe("ro-RO");
			store.set(LOCALE_STORAGE_KEY, "en-US");
			expect(resolveInitialLocale(["ro-RO"])).toBe("en-US");
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				configurable: true,
				value: original,
			});
		}
	});

	it("rejects invalid stored values", () => {
		expect(isAppLocale("not-a-locale")).toBe(false);
		const locale: AppLocale = "en-US";
		expect(locale).toBe("en-US");
	});
});
