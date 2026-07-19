import {
	DEFAULT_LOCALE,
	LOCALE_STORAGE_KEY,
	SUPPORTED_LOCALES,
	detectLocaleFromLanguages,
	isAppLocale,
	resolveInitialLocale,
	type AppLocale,
} from "@test-worker/i18n";
import { describe, expect, it } from "vitest";

describe("locale resolution", () => {
	it("detects exact locale tags", () => {
		expect(detectLocaleFromLanguages(["ro-RO", "en"])).toBe("ro-RO");
		expect(detectLocaleFromLanguages(["en-US"])).toBe("en-US");
	});

	it("falls back from language-only tags", () => {
		expect(detectLocaleFromLanguages(["ro"])).toBe("ro-RO");
		expect(detectLocaleFromLanguages(["en-GB"])).toBe("en-US");
	});

	it("uses default when nothing matches", () => {
		expect(detectLocaleFromLanguages(["de-DE", "fr"])).toBe(DEFAULT_LOCALE);
	});

	it("validates supported locales", () => {
		expect(isAppLocale("en-US")).toBe(true);
		expect(isAppLocale("ro-RO")).toBe(true);
		expect(isAppLocale("de-DE")).toBe(false);
		expect(SUPPORTED_LOCALES).toContain("en-US");
		expect(SUPPORTED_LOCALES).toContain("ro-RO");
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
