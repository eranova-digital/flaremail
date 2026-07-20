import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accountProfiles, accounts, mailboxes } from "../../db/schema";
import { isPlatformPrincipal } from "../../lib/auth/principal";
import type { Principal } from "../../lib/auth/types";
import {
	type IdentityNamePattern,
	isIdentityNamePattern,
	resolveFromName,
} from "@flaremail/identity-name-pattern";
import { getInstanceSettings, type InstanceSettings } from "../instance-settings";

export const DEFAULT_IDENTITY_ID = "default";

/** Synthetic identity for system/blackhole mailboxes with no stored identities. */
export const SYSTEM_MAILBOX_FALLBACK_IDENTITY_ID = "system-fallback";

export type IdentityDto = {
	id: string;
	mailboxId: string | null;
	isDefault: boolean;
	namePattern: IdentityNamePattern;
	customName: string | null;
	signatureHtml: string | null;
	fromNamePreview: string;
	createdAt: string | null;
	updatedAt: string | null;
};

export type IdentityListResult = {
	items: IdentityDto[];
	capabilities: {
		canManage: boolean;
		customNameAllowed: boolean;
	};
};

export type AccountIdentitiesOverview = {
	own: IdentityDto[];
	default: IdentityDto | null;
	shared: Array<{
		mailboxId: string;
		mailboxAddress: string;
		identityExport: boolean;
		identities: IdentityDto[];
	}>;
	capabilities: {
		canManageOwn: boolean;
		customNameAllowed: boolean;
		primaryMailboxId: string | null;
	};
};

export class IdentityAccessDeniedError extends Error {
	constructor(message = "You do not have permission to manage this identity") {
		super(message);
		this.name = "IdentityAccessDeniedError";
	}
}

export class IdentityValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "IdentityValidationError";
	}
}

export type IdentityInput = {
	namePattern: IdentityNamePattern;
	customName?: string | null;
	signatureHtml?: string | null;
};

export function roleBypassesCustomNameGate(principal: Principal): boolean {
	if (principal.isIntendant || isPlatformPrincipal(principal)) {
		return true;
	}
	return (
		principal.role === "admin" ||
		principal.role === "superadmin"
	);
}

export function assertCustomNameAllowed(
	principal: Principal,
	settings: InstanceSettings,
	pattern: IdentityNamePattern,
): void {
	if (pattern !== "custom") {
		return;
	}
	if (settings.customNameAllowance || roleBypassesCustomNameGate(principal)) {
		return;
	}
	throw new IdentityValidationError(
		"Custom names are disabled for your role",
	);
}

export function normalizeCreateInput(input: IdentityInput) {
	const customName =
		input.namePattern === "custom"
			? (input.customName ?? "").trim() || null
			: null;
	if (input.namePattern === "custom" && !customName) {
		throw new IdentityValidationError("customName is required for custom pattern");
	}
	return {
		namePattern: input.namePattern,
		customName,
		signatureHtml:
			typeof input.signatureHtml === "string"
				? input.signatureHtml.trim() || null
				: null,
	};
}

/** Normalize create/update body where signature may be omitted on patch. */
export function normalizePatchInput(
	input: Partial<IdentityInput> & { namePattern?: IdentityNamePattern },
) {
	const patch: {
		namePattern?: IdentityNamePattern;
		customName?: string | null;
		signatureHtml?: string | null;
	} = {};

	if (input.namePattern !== undefined) {
		patch.namePattern = input.namePattern;
	}
	if (input.customName !== undefined) {
		patch.customName =
			input.customName === null ? null : String(input.customName).trim() || null;
	}
	if (input.signatureHtml !== undefined) {
		patch.signatureHtml =
			input.signatureHtml === null
				? null
				: String(input.signatureHtml).trim() || null;
	}
	return patch;
}

export async function loadProfileForAccount(
	db: Database,
	accountId: string | null,
): Promise<{ firstName: string; lastName: string }> {
	if (!accountId) {
		return { firstName: "", lastName: "" };
	}
	const [profile] = await db
		.select({
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
		})
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, accountId))
		.limit(1);
	return {
		firstName: profile?.firstName ?? "",
		lastName: profile?.lastName ?? "",
	};
}

/**
 * Resolve the profile used for From-name previews on a mailbox.
 * Primary mailboxes preview against the mailbox owner's profile so admins
 * managing another account see that person's name, not their own.
 */
export async function loadProfileForMailboxPreview(
	db: Database,
	mailboxId: string,
	fallbackAccountId: string | null,
): Promise<{ firstName: string; lastName: string }> {
	const [owner] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(eq(accounts.primaryMailboxId, mailboxId))
		.limit(1);
	if (owner) {
		return loadProfileForAccount(db, owner.id);
	}
	return loadProfileForAccount(db, fallbackAccountId);
}

export function toIdentityDto(
	row: {
		id: string;
		mailboxId: string;
		namePattern: IdentityNamePattern;
		customName: string | null;
		signatureHtml: string | null;
		createdAt: Date;
		updatedAt: Date;
	},
	profile: { firstName: string; lastName: string },
): IdentityDto {
	return {
		id: row.id,
		mailboxId: row.mailboxId,
		isDefault: false,
		namePattern: row.namePattern,
		customName: row.customName,
		signatureHtml: row.signatureHtml,
		fromNamePreview: resolveFromName(
			row.namePattern,
			profile,
			row.customName,
		),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export function toDefaultIdentityDto(
	settings: Awaited<ReturnType<typeof getInstanceSettings>>,
	profile: { firstName: string; lastName: string },
): IdentityDto {
	const namePattern = settings.defaultIdentityNamePattern;
	const customName = settings.defaultIdentityCustomName;
	return {
		id: DEFAULT_IDENTITY_ID,
		mailboxId: null,
		isDefault: true,
		namePattern,
		customName,
		signatureHtml: settings.defaultIdentitySignatureHtml,
		fromNamePreview: resolveFromName(namePattern, profile, customName),
		createdAt: null,
		updatedAt: settings.updatedAt,
	};
}

export function toSystemMailboxFallbackIdentityDto(mailboxId: string): IdentityDto {
	return {
		id: SYSTEM_MAILBOX_FALLBACK_IDENTITY_ID,
		mailboxId,
		isDefault: true,
		namePattern: "none",
		customName: null,
		signatureHtml: null,
		fromNamePreview: "",
		createdAt: null,
		updatedAt: null,
	};
}

export async function getMailboxRow(db: Database, mailboxId: string) {
	const [row] = await db
		.select()
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!row) {
		throw new Error("Mailbox not found");
	}
	return row;
}

export function parseIdentityNamePattern(
	value: unknown,
): IdentityNamePattern | undefined {
	return isIdentityNamePattern(value) ? value : undefined;
}
