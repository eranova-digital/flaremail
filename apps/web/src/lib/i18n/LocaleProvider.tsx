import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import {
	isAppLocale,
	setStoredLocale,
	type AppLocale,
} from "@test-worker/i18n";

import { applyDocumentLocale } from "@/lib/i18n";

type LocaleContextValue = {
	locale: AppLocale;
	setLocale: (locale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
	const { i18n } = useTranslation();
	const [locale, setLocaleState] = useState<AppLocale>(() =>
		isAppLocale(i18n.language) ? i18n.language : "en-US",
	);

	useEffect(() => {
		const onLanguageChanged = (lng: string) => {
			if (isAppLocale(lng)) {
				setLocaleState(lng);
				applyDocumentLocale(lng);
			}
		};
		i18n.on("languageChanged", onLanguageChanged);
		return () => {
			i18n.off("languageChanged", onLanguageChanged);
		};
	}, [i18n]);

	const setLocale = useCallback(
		(next: AppLocale) => {
			setStoredLocale(next);
			setLocaleState(next);
			void i18n.changeLanguage(next);
			applyDocumentLocale(next);
		},
		[i18n],
	);

	const value = useMemo(
		() => ({
			locale,
			setLocale,
		}),
		[locale, setLocale],
	);

	return (
		<LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
	);
}

export function useLocale(): LocaleContextValue {
	const context = useContext(LocaleContext);
	if (!context) {
		throw new Error("useLocale must be used within LocaleProvider");
	}
	return context;
}
