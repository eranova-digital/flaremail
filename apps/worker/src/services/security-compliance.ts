import type { AccountRole } from "../lib/auth/types";
import type { IdentityNamePattern } from "@test-worker/identity-name-pattern";

export type OrganizationTabAccess =
	| "intendant_only"
	| "intendant_and_superadmins";

export type RequireMfaScope =
	| "none"
	| "all"
	| "manager_and_above"
	| "admin_and_above"
	| "superadmin_and_above";

export type LogRetentionDays = 3 | 7 | 14 | 30 | 60 | 90;

export type InstanceSettings = {
	organizationTabAccess: OrganizationTabAccess;
	requireMfaScope: RequireMfaScope;
	requireRecoveryEmail: boolean;
	persistNoreplyOutboundEmails: boolean;
	identitySelfServe: boolean;
	customNameAllowance: boolean;
	defaultIdentityNamePattern: IdentityNamePattern;
	defaultIdentityCustomName: string | null;
	defaultIdentitySignatureHtml: string | null;
	logsEnabled: boolean;
	maxImportanceStored: number;
	logRetentionDays: LogRetentionDays;
};

export type SecurityRequirements = {
	recoveryEmail: boolean;
	mfa: boolean;
};

export type OrganizationPolicies = {
	mfaRequired: boolean;
	recoveryEmailRequired: boolean;
};

export const DEFAULT_INSTANCE_SETTINGS: InstanceSettings = {
	organizationTabAccess: "intendant_only",
	requireMfaScope: "none",
	requireRecoveryEmail: false,
	persistNoreplyOutboundEmails: false,
	identitySelfServe: true,
	customNameAllowance: false,
	defaultIdentityNamePattern: "first_name_last_name",
	defaultIdentityCustomName: null,
	defaultIdentitySignatureHtml: null,
	logsEnabled: true,
	maxImportanceStored: 10,
	logRetentionDays: 14,
};

export const LOG_RETENTION_DAY_OPTIONS: LogRetentionDays[] = [
	3, 7, 14, 30, 60, 90,
];

const ROLE_RANK: Record<AccountRole, number> = {
	user: 0,
	manager: 1,
	admin: 2,
	superadmin: 3,
};

const MFA_SCOPE_MIN_RANK: Record<
	Exclude<RequireMfaScope, "none" | "all">,
	number
> = {
	manager_and_above: 1,
	admin_and_above: 2,
	superadmin_and_above: 3,
};

export function roleRequiresMfa(
	role: AccountRole | null,
	scope: RequireMfaScope,
): boolean {
	if (scope === "none") {
		return false;
	}
	if (scope === "all") {
		return true;
	}
	if (!role) {
		return false;
	}
	return ROLE_RANK[role] >= MFA_SCOPE_MIN_RANK[scope];
}

export function getSecurityRequirements(
	account: {
		isIntendant: boolean;
		role: AccountRole | null;
		profile: { recoveryAddress: string | null } | null;
		mfaEnabled: boolean;
	},
	settings: InstanceSettings,
): SecurityRequirements {
	if (account.isIntendant) {
		return { recoveryEmail: false, mfa: false };
	}

	const needsRecovery =
		settings.requireRecoveryEmail &&
		!account.profile?.recoveryAddress?.trim();
	const needsMfa =
		roleRequiresMfa(account.role, settings.requireMfaScope) &&
		!account.mfaEnabled;

	return {
		recoveryEmail: needsRecovery,
		mfa: needsMfa,
	};
}

export function getOrganizationPolicies(
	account: {
		isIntendant: boolean;
		role: AccountRole | null;
	},
	settings: InstanceSettings,
): OrganizationPolicies {
	if (account.isIntendant) {
		return { mfaRequired: false, recoveryEmailRequired: false };
	}

	return {
		mfaRequired: roleRequiresMfa(account.role, settings.requireMfaScope),
		recoveryEmailRequired: settings.requireRecoveryEmail,
	};
}

export function canAccessOrganizationSettings(
	principal: { isIntendant: boolean; role: AccountRole | null },
	settings: InstanceSettings,
): boolean {
	if (principal.isIntendant) {
		return true;
	}
	return (
		settings.organizationTabAccess === "intendant_and_superadmins" &&
		principal.role === "superadmin"
	);
}

export function assertMfaCanBeDisabled(
	account: { isIntendant: boolean; role: AccountRole | null },
	settings: InstanceSettings,
): void {
	if (account.isIntendant) {
		return;
	}
	if (
		roleRequiresMfa(account.role, settings.requireMfaScope)
	) {
		throw new Error(
			"Two-factor authentication is required by your organization and cannot be disabled",
		);
	}
}

export function assertRecoveryEmailCanBeRemoved(
	account: { isIntendant: boolean },
	settings: InstanceSettings,
): void {
	if (account.isIntendant) {
		return;
	}
	if (settings.requireRecoveryEmail) {
		throw new Error(
			"A recovery email is required by your organization and cannot be removed",
		);
	}
}
