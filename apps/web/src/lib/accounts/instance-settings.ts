import { apiRequest } from "@/lib/api/request";

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
	updatedAt: string;
	updatedByAccountId: string | null;
};

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

export const ORGANIZATION_TAB_ACCESS_OPTIONS: {
	value: OrganizationTabAccess;
	label: string;
	description: string;
}[] = [
	{
		value: "intendant_only",
		label: "Only me",
		description: "Only the recovery account can view and manage organization settings.",
	},
	{
		value: "intendant_and_superadmins",
		label: "Me & owners",
		description:
			"Owners (superadmins) can also view and manage organization security policies.",
	},
];

export const REQUIRE_MFA_SCOPE_OPTIONS: {
	value: RequireMfaScope;
	label: string;
	description: string;
}[] = [
	{
		value: "none",
		label: "Not required",
		description: "Two-factor authentication remains optional for everyone.",
	},
	{
		value: "all",
		label: "All accounts",
		description: "Every account must enable 2FA on activation or next sign-in.",
	},
	{
		value: "manager_and_above",
		label: "Managers and above",
		description: "Managers, admins, and owners must enable 2FA.",
	},
	{
		value: "admin_and_above",
		label: "Admins and above",
		description: "Admins and owners must enable 2FA.",
	},
	{
		value: "superadmin_and_above",
		label: "Owners and above",
		description: "Only owner accounts must enable 2FA.",
	},
];
