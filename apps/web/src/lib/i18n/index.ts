import {
	DEFAULT_LOCALE,
	I18N_NAMESPACES,
	isAppLocale,
	resolveInitialLocale,
	resources,
	type AppLocale,
} from "@flaremail/i18n";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
	resources,
	lng: resolveInitialLocale(),
	fallbackLng: DEFAULT_LOCALE,
	defaultNS: "common",
	ns: [...I18N_NAMESPACES],
	interpolation: {
		escapeValue: false,
	},
	returnNull: false,
});

export function applyDocumentLocale(locale: AppLocale): void {
	document.documentElement.lang = locale;
}

applyDocumentLocale(
	isAppLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE,
);

i18n.on("languageChanged", (lng) => {
	if (isAppLocale(lng)) {
		applyDocumentLocale(lng);
	}
});

export default i18n;
