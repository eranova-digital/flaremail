export const THEME_STORAGE_KEY = "flaremail:theme";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
	return (
		typeof value === "string" &&
		(THEME_PREFERENCES as readonly string[]).includes(value)
	);
}

export function getThemePreference(): ThemePreference {
	try {
		const raw = localStorage.getItem(THEME_STORAGE_KEY);
		if (isThemePreference(raw)) {
			return raw;
		}
	} catch {
		// ignore quota / private mode
	}
	return "system";
}

export function setThemePreference(preference: ThemePreference): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {
		// ignore quota / private mode
	}
}

export function getSystemTheme(
	mediaQuery = window.matchMedia("(prefers-color-scheme: dark)"),
): ResolvedTheme {
	return mediaQuery.matches ? "dark" : "light";
}

export function resolveTheme(
	preference: ThemePreference,
	systemTheme: ResolvedTheme = getSystemTheme(),
): ResolvedTheme {
	if (preference === "system") {
		return systemTheme;
	}
	return preference;
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
	const root = document.documentElement;
	root.classList.toggle("dark", theme === "dark");
	root.style.colorScheme = theme;
}
