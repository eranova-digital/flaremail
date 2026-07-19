import enAuth from "./locales/en-US/auth.json";
import enCommon from "./locales/en-US/common.json";
import enCompose from "./locales/en-US/compose.json";
import enErrors from "./locales/en-US/errors.json";
import enMail from "./locales/en-US/mail.json";
import enManagement from "./locales/en-US/management.json";
import enSettings from "./locales/en-US/settings.json";
import roAuth from "./locales/ro-RO/auth.json";
import roCommon from "./locales/ro-RO/common.json";
import roCompose from "./locales/ro-RO/compose.json";
import roErrors from "./locales/ro-RO/errors.json";
import roMail from "./locales/ro-RO/mail.json";
import roManagement from "./locales/ro-RO/management.json";
import roSettings from "./locales/ro-RO/settings.json";

export const resources = {
	"en-US": {
		common: enCommon,
		errors: enErrors,
		auth: enAuth,
		mail: enMail,
		compose: enCompose,
		settings: enSettings,
		management: enManagement,
	},
	"ro-RO": {
		common: roCommon,
		errors: roErrors,
		auth: roAuth,
		mail: roMail,
		compose: roCompose,
		settings: roSettings,
		management: roManagement,
	},
} as const;
