import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { instanceSettings } from "../db/schema";
import type { AccountRole } from "../lib/auth/types";
import type { Principal } from "../lib/auth/types";
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
	if (roleRequiresMfa(account.role, settings.requireMfaScope)) {
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

export type InstanceSettingsRecord = InstanceSettings & {
	updatedAt: string;
	updatedByAccountId: string | null;
};

export class InstanceSettingsAccessDeniedError extends Error {
	constructor() {
		super("You do not have permission to manage organization settings");
		this.name = "InstanceSettingsAccessDeniedError";
	}
}

export class OrganizationTabAccessDeniedError extends Error {
	constructor() {
		super("Only the intendant can change organization tab access");
		this.name = "OrganizationTabAccessDeniedError";
	}
}

const INSTANCE_SETTINGS_ID = "default";

export async function getInstanceSettings(
	db: Database,
): Promise<InstanceSettingsRecord> {
	await ensureInstanceSettingsRow(db);

	const [row] = await db
		.select()
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
		.limit(1);

	if (!row) {
		return {
			...DEFAULT_INSTANCE_SETTINGS,
			updatedAt: new Date().toISOString(),
			updatedByAccountId: null,
		};
	}

	return rowToRecord(row);
}

export async function updateInstanceSettings(
	db: Database,
	principal: Principal,
	input: Partial<InstanceSettings>,
): Promise<InstanceSettingsRecord> {
	if (!principal.accountId) {
		throw new InstanceSettingsAccessDeniedError();
	}

	const current = await getInstanceSettings(db);
	if (!canAccessOrganizationSettings(principal, current)) {
		throw new InstanceSettingsAccessDeniedError();
	}

	if (
		input.organizationTabAccess !== undefined &&
		!principal.isIntendant
	) {
		throw new OrganizationTabAccessDeniedError();
	}

	const patch: Partial<typeof instanceSettings.$inferInsert> = {
		updatedAt: new Date(),
		updatedByAccountId: principal.accountId,
	};

	if (input.organizationTabAccess !== undefined) {
		patch.organizationTabAccess = input.organizationTabAccess;
	}
	if (input.requireMfaScope !== undefined) {
		patch.requireMfaScope = input.requireMfaScope;
	}
	if (input.requireRecoveryEmail !== undefined) {
		patch.requireRecoveryEmail = input.requireRecoveryEmail;
	}
	if (input.persistNoreplyOutboundEmails !== undefined) {
		patch.persistNoreplyOutboundEmails = input.persistNoreplyOutboundEmails;
	}
	if (input.identitySelfServe !== undefined) {
		patch.identitySelfServe = input.identitySelfServe;
	}
	if (input.customNameAllowance !== undefined) {
		patch.customNameAllowance = input.customNameAllowance;
	}
	if (input.defaultIdentityNamePattern !== undefined) {
		patch.defaultIdentityNamePattern = input.defaultIdentityNamePattern;
	}
	if (input.defaultIdentityCustomName !== undefined) {
		patch.defaultIdentityCustomName = input.defaultIdentityCustomName;
	}
	if (input.defaultIdentitySignatureHtml !== undefined) {
		patch.defaultIdentitySignatureHtml = input.defaultIdentitySignatureHtml;
	}
	if (input.logsEnabled !== undefined) {
		patch.logsEnabled = input.logsEnabled;
	}
	if (input.maxImportanceStored !== undefined) {
		patch.maxImportanceStored = input.maxImportanceStored;
	}
	if (input.logRetentionDays !== undefined) {
		patch.logRetentionDays = String(input.logRetentionDays) as
			| "3"
			| "7"
			| "14"
			| "30"
			| "60"
			| "90";
	}

	await db
		.update(instanceSettings)
		.set(patch)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));

	return getInstanceSettings(db);
}

function rowToRecord(
	row: typeof instanceSettings.$inferSelect,
): InstanceSettingsRecord {
	return {
		organizationTabAccess: row.organizationTabAccess,
		requireMfaScope: row.requireMfaScope,
		requireRecoveryEmail: row.requireRecoveryEmail,
		persistNoreplyOutboundEmails: row.persistNoreplyOutboundEmails,
		identitySelfServe: row.identitySelfServe,
		customNameAllowance: row.customNameAllowance,
		defaultIdentityNamePattern: row.defaultIdentityNamePattern,
		defaultIdentityCustomName: row.defaultIdentityCustomName,
		defaultIdentitySignatureHtml: row.defaultIdentitySignatureHtml,
		logsEnabled: row.logsEnabled,
		maxImportanceStored: row.maxImportanceStored,
		logRetentionDays: Number(row.logRetentionDays) as LogRetentionDays,
		updatedAt: row.updatedAt.toISOString(),
		updatedByAccountId: row.updatedByAccountId,
	};
}

async function ensureInstanceSettingsRow(db: Database): Promise<void> {
	const [existing] = await db
		.select({ id: instanceSettings.id })
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
		.limit(1);

	if (existing) {
		return;
	}

	await db.insert(instanceSettings).values({ id: INSTANCE_SETTINGS_ID });
}

export function parseOrganizationTabAccess(
	value: unknown,
): OrganizationTabAccess | undefined {
	if (
		value === "intendant_only" ||
		value === "intendant_and_superadmins"
	) {
		return value;
	}
	return undefined;
}

export function parseRequireMfaScope(value: unknown): RequireMfaScope | undefined {
	if (
		value === "none" ||
		value === "all" ||
		value === "manager_and_above" ||
		value === "admin_and_above" ||
		value === "superadmin_and_above"
	) {
		return value;
	}
	return undefined;
}

export function parseLogRetentionDays(
	value: unknown,
): LogRetentionDays | undefined {
	const n = typeof value === "string" ? Number(value) : value;
	if (
		typeof n === "number" &&
		LOG_RETENTION_DAY_OPTIONS.includes(n as LogRetentionDays)
	) {
		return n as LogRetentionDays;
	}
	return undefined;
}

export function parseMaxImportanceStored(value: unknown): number | undefined {
	const n = typeof value === "string" ? Number(value) : value;
	if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10) {
		return n;
	}
	return undefined;
}
