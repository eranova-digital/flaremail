import { apiRequest } from "@/lib/api/request";
import i18n from "@/lib/i18n";

export type OrganizationTabAccess =
	| "intendant_only"
	| "intendant_and_superadmins";

export type RequireMfaScope =
	| "none"
	| "all"
	| "manager_and_above"
	| "admin_and_above"
	| "superadmin_and_above";

export type InstanceSettings = {
	organizationTabAccess: OrganizationTabAccess;
	requireMfaScope: RequireMfaScope;
	requireRecoveryEmail: boolean;
	persistNoreplyOutboundEmails: boolean;
	identitySelfServe: boolean;
	customNameAllowance: boolean;
	defaultIdentityNamePattern: string;
	defaultIdentityCustomName: string | null;
	defaultIdentitySignatureHtml: string | null;
	logsEnabled: boolean;
	maxImportanceStored: number;
	logRetentionDays: LogRetentionDays;
	updatedAt: string;
	updatedByAccountId: string | null;
};

export type LogRetentionDays = 3 | 7 | 14 | 30 | 60 | 90;

export type UpdateInstanceSettingsInput = Partial<{
	organizationTabAccess: OrganizationTabAccess;
	requireMfaScope: RequireMfaScope;
	requireRecoveryEmail: boolean;
	persistNoreplyOutboundEmails: boolean;
	identitySelfServe: boolean;
	customNameAllowance: boolean;
	defaultIdentityNamePattern: string;
	defaultIdentityCustomName: string | null;
	defaultIdentitySignatureHtml: string | null;
	logsEnabled: boolean;
	maxImportanceStored: number;
	logRetentionDays: LogRetentionDays;
}>;

export async function fetchInstanceSettings(): Promise<InstanceSettings> {
	return apiRequest<InstanceSettings>("/instance/settings");
}

export async function updateInstanceSettings(
	input: UpdateInstanceSettingsInput,
): Promise<InstanceSettings> {
	return apiRequest<InstanceSettings>("/instance/settings", {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}

const ORGANIZATION_TAB_ACCESS_VALUES: OrganizationTabAccess[] = [
	"intendant_only",
	"intendant_and_superadmins",
];

const REQUIRE_MFA_SCOPE_VALUES: RequireMfaScope[] = [
	"none",
	"all",
	"manager_and_above",
	"admin_and_above",
	"superadmin_and_above",
];

const LOG_RETENTION_DAY_VALUES: LogRetentionDays[] = [3, 7, 14, 30, 60, 90];

export function getOrganizationTabAccessOptions(): {
	value: OrganizationTabAccess;
	label: string;
	description: string;
}[] {
	return ORGANIZATION_TAB_ACCESS_VALUES.map((value) => ({
		value,
		label: i18n.t(`organization.tabAccess.${value}`, { ns: "management" }),
		description: i18n.t(`organization.tabAccess.${value}Description`, {
			ns: "management",
		}),
	}));
}

export function getRequireMfaScopeOptions(): {
	value: RequireMfaScope;
	label: string;
	description: string;
}[] {
	return REQUIRE_MFA_SCOPE_VALUES.map((value) => ({
		value,
		label: i18n.t(`organization.requireMfa.${value}`, { ns: "management" }),
		description: i18n.t(`organization.requireMfa.${value}Description`, {
			ns: "management",
		}),
	}));
}

export function getLogRetentionDayOptions(): {
	value: LogRetentionDays;
	label: string;
}[] {
	return LOG_RETENTION_DAY_VALUES.map((value) => ({
		value,
		label: i18n.t("organization.retention.days", {
			ns: "management",
			count: value,
		}),
	}));
}

/** Locale-aware; prefer getOrganizationTabAccessOptions() at call sites. */
export const ORGANIZATION_TAB_ACCESS_OPTIONS: {
	value: OrganizationTabAccess;
	label: string;
	description: string;
}[] = ORGANIZATION_TAB_ACCESS_VALUES.map((value) => ({
	value,
	get label() {
		return i18n.t(`organization.tabAccess.${value}`, { ns: "management" });
	},
	get description() {
		return i18n.t(`organization.tabAccess.${value}Description`, {
			ns: "management",
		});
	},
}));

/** Locale-aware; prefer getRequireMfaScopeOptions() at call sites. */
export const REQUIRE_MFA_SCOPE_OPTIONS: {
	value: RequireMfaScope;
	label: string;
	description: string;
}[] = REQUIRE_MFA_SCOPE_VALUES.map((value) => ({
	value,
	get label() {
		return i18n.t(`organization.requireMfa.${value}`, { ns: "management" });
	},
	get description() {
		return i18n.t(`organization.requireMfa.${value}Description`, {
			ns: "management",
		});
	},
}));

/** Locale-aware; prefer getLogRetentionDayOptions() at call sites. */
export const LOG_RETENTION_DAY_OPTIONS: {
	value: LogRetentionDays;
	label: string;
}[] = LOG_RETENTION_DAY_VALUES.map((value) => ({
	value,
	get label() {
		return i18n.t("organization.retention.days", {
			ns: "management",
			count: value,
		});
	},
}));
