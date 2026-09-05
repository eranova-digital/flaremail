import { DEFAULT_LOCALE, resources, SUPPORTED_LOCALES } from "@flaremail/i18n";
import { describe, expect, it } from "vitest";

function flatten(
	value: unknown,
	prefix = "",
	out: Record<string, string> = {},
): Record<string, string> {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		if (prefix) {
			out[prefix] = value == null ? "" : String(value);
		}
		return out;
	}
	for (const [key, nested] of Object.entries(value)) {
		flatten(nested, prefix ? `${prefix}.${key}` : key, out);
	}
	return out;
}

describe("locale catalogs", () => {
	const english = flatten(resources[DEFAULT_LOCALE]);
	const englishKeys = Object.keys(english);

	it("has the same keys in every locale as en-US", () => {
		for (const locale of SUPPORTED_LOCALES) {
			if (locale === DEFAULT_LOCALE) {
				continue;
			}
			const keys = new Set(Object.keys(flatten(resources[locale])));
			const missing = englishKeys.filter((key) => !keys.has(key));
			const extra = [...keys].filter((key) => !(key in english));
			expect({ locale, missing, extra }).toEqual({
				locale,
				missing: [],
				extra: [],
			});
		}
	});

	it("has no empty string values", () => {
		for (const locale of SUPPORTED_LOCALES) {
			const empty = Object.entries(flatten(resources[locale]))
				.filter(([, value]) => value.trim() === "")
				.map(([key]) => key);
			expect({ locale, empty }).toEqual({ locale, empty: [] });
		}
	});
});
