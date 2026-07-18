import { describe, expect, it, beforeEach, vi } from "vitest";

import {
	THEME_STORAGE_KEY,
	applyResolvedTheme,
	getThemePreference,
	isThemePreference,
	resolveTheme,
	setThemePreference,
} from "./theme-preference";

describe("theme preference", () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.classList.remove("dark");
		document.documentElement.style.colorScheme = "";
	});

	it("treats only light, dark, and system as valid preferences", () => {
		expect(isThemePreference("light")).toBe(true);
		expect(isThemePreference("dark")).toBe(true);
		expect(isThemePreference("system")).toBe(true);
		expect(isThemePreference("auto")).toBe(false);
		expect(isThemePreference(null)).toBe(false);
	});

	it("defaults to system when nothing is stored", () => {
		expect(getThemePreference()).toBe("system");
	});

	it("reads and writes the preference from localStorage", () => {
		setThemePreference("dark");
		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
		expect(getThemePreference()).toBe("dark");
	});

	it("falls back to system for invalid stored values", () => {
		localStorage.setItem(THEME_STORAGE_KEY, "neon");
		expect(getThemePreference()).toBe("system");
	});

	it("resolves system against the provided system theme", () => {
		expect(resolveTheme("light", "dark")).toBe("light");
		expect(resolveTheme("dark", "light")).toBe("dark");
		expect(resolveTheme("system", "dark")).toBe("dark");
		expect(resolveTheme("system", "light")).toBe("light");
	});

	it("applies the dark class and color-scheme on the document root", () => {
		applyResolvedTheme("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.style.colorScheme).toBe("dark");

		applyResolvedTheme("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.style.colorScheme).toBe("light");
	});

	it("ignores localStorage write failures", () => {
		const setItem = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(() => {
				throw new Error("quota");
			});

		expect(() => setThemePreference("light")).not.toThrow();
		setItem.mockRestore();
	});
});
