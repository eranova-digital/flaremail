import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { instanceSettings } from "../db/schema";
import type { Principal } from "../lib/auth/types";
import {
	canAccessOrganizationSettings,
	DEFAULT_INSTANCE_SETTINGS,
	LOG_RETENTION_DAY_OPTIONS,
	type InstanceSettings,
	type LogRetentionDays,
	type OrganizationTabAccess,
	type RequireMfaScope,
} from "./security-compliance";

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
