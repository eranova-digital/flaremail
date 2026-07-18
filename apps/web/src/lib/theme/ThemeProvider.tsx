import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import {
	applyResolvedTheme,
	getSystemTheme,
	getThemePreference,
	resolveTheme,
	setThemePreference as persistThemePreference,
	type ResolvedTheme,
	type ThemePreference,
} from "@/lib/theme-preference";

type ThemeContextValue = {
	preference: ThemePreference;
	resolvedTheme: ResolvedTheme;
	setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [preference, setPreferenceState] = useState<ThemePreference>(() =>
		getThemePreference(),
	);
	const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
		getSystemTheme(),
	);

	const resolvedTheme = resolveTheme(preference, systemTheme);

	useEffect(() => {
		applyResolvedTheme(resolvedTheme);
	}, [resolvedTheme]);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			setSystemTheme(getSystemTheme(mediaQuery));
		};

		onChange();
		mediaQuery.addEventListener("change", onChange);
		return () => mediaQuery.removeEventListener("change", onChange);
	}, []);

	const setPreference = useCallback((next: ThemePreference) => {
		persistThemePreference(next);
		setPreferenceState(next);
	}, []);

	const value = useMemo(
		() => ({
			preference,
			resolvedTheme,
			setPreference,
		}),
		[preference, resolvedTheme, setPreference],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within ThemeProvider");
	}
	return context;
}
