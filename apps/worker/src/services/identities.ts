import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountProfiles,
	accounts,
	identities,
	mailboxes,
} from "../db/schema";
import { authorizeAccount } from "../lib/auth/access";
import {
	assertPrincipalCanAccessMailbox,
	collectManageableMailboxIds,
	collectReadableMailboxIds,
} from "../lib/auth/mailbox-access";
import { isPlatformPrincipal } from "../lib/auth/principal";
import type { Principal } from "../lib/auth/types";
import {
	type IdentityNamePattern,
	isIdentityNamePattern,
	resolveFromName,
} from "../lib/identities/name-pattern";
import { loadAccountMailboxGrants } from "./accounts/shared";
import { getInstanceSettings } from "./instance-settings";
import { type InstanceSettings } from "./security-compliance";

export const DEFAULT_IDENTITY_ID = "default";

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

type IdentityInput = {
	namePattern: IdentityNamePattern;
	customName?: string | null;
	signatureHtml?: string | null;
};

function roleBypassesCustomNameGate(principal: Principal): boolean {
	if (principal.isIntendant || isPlatformPrincipal(principal)) {
		return true;
	}
	return (
		principal.role === "admin" ||
		principal.role === "superadmin"
	);
}

function assertCustomNameAllowed(
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

function normalizeCreateInput(input: IdentityInput) {
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
function normalizePatchInput(input: Partial<IdentityInput> & { namePattern?: IdentityNamePattern }) {
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

async function loadProfileForAccount(
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
async function loadProfileForMailboxPreview(
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

function toIdentityDto(
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

function toDefaultIdentityDto(
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

async function getMailboxRow(db: Database, mailboxId: string) {
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

/**
 * Who may create/update/delete mailbox-owned identities (not the default identity).
 */
export async function assertCanManageMailboxIdentities(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	const mailbox = await getMailboxRow(db, mailboxId);

	if (mailbox.type === "system" || mailbox.type === "blackhole") {
		if (!principal.isIntendant) {
			throw new IdentityAccessDeniedError(
				"Only the intendant can manage system mailbox identities",
			);
		}
		return;
	}

	if (mailbox.type === "alias") {
		throw new IdentityValidationError("Alias mailboxes cannot have identities");
	}

	if (isPlatformPrincipal(principal) || principal.isIntendant) {
		return;
	}

	if (principal.role === "superadmin") {
		return;
	}

	if (principal.role === "admin") {
		const manageable = await collectManageableMailboxIds(db, principal);
		if (!manageable.has(mailboxId)) {
			throw new IdentityAccessDeniedError();
		}
		return;
	}

	if (mailbox.type === "shared") {
		if (principal.role === "manager") {
			const manageable = await collectManageableMailboxIds(db, principal);
			if (!manageable.has(mailboxId)) {
				throw new IdentityAccessDeniedError();
			}
			return;
		}
		throw new IdentityAccessDeniedError();
	}

	// Primary (or secondary): self-serve for own primary, else elevated already handled above
	if (mailbox.type === "primary") {
		const isOwnPrimary =
			principal.primaryMailboxId !== null &&
			principal.primaryMailboxId === mailboxId;

		if (isOwnPrimary) {
			const settings = await getInstanceSettings(db);
			if (settings.identitySelfServe) {
				return;
			}
			throw new IdentityAccessDeniedError(
				"Identity self-serve is disabled",
			);
		}

		throw new IdentityAccessDeniedError();
	}

	// secondary: treat like primary ownership via grants — only admins/managers via manage set
	const manageable = await collectManageableMailboxIds(db, principal);
	if (manageable.has(mailboxId)) {
		return;
	}
	throw new IdentityAccessDeniedError();
}

/**
 * Listing identities is allowed when the principal can manage them, or when
 * they have mail access to the mailbox (e.g. selecting From personas).
 * Elevated roles may manage identities on primary mailboxes they cannot read.
 */
async function assertCanListMailboxIdentities(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	try {
		await assertCanManageMailboxIdentities(db, principal, mailboxId);
		return;
	} catch (error) {
		if (error instanceof IdentityValidationError) {
			throw error;
		}
		if (!(error instanceof IdentityAccessDeniedError)) {
			throw error;
		}
	}
	await assertPrincipalCanAccessMailbox(db, principal, mailboxId);
}

export async function listMailboxIdentities(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<IdentityListResult> {
	await assertCanListMailboxIdentities(db, principal, mailboxId);
	const mailbox = await getMailboxRow(db, mailboxId);
	const profile = await loadProfileForMailboxPreview(
		db,
		mailboxId,
		principal.accountId,
	);
	const settings = await getInstanceSettings(db);

	const rows = await db
		.select()
		.from(identities)
		.where(eq(identities.mailboxId, mailboxId))
		.orderBy(asc(identities.createdAt));

	const items = rows.map((row) =>
		toIdentityDto(
			{
				...row,
				namePattern: row.namePattern as IdentityNamePattern,
			},
			profile,
		),
	);

	if (mailbox.type === "primary") {
		items.unshift(toDefaultIdentityDto(settings, profile));
	}

	let canManage = false;
	try {
		await assertCanManageMailboxIdentities(db, principal, mailboxId);
		canManage = true;
	} catch {
		canManage = false;
	}

	return {
		items,
		capabilities: {
			canManage,
			customNameAllowed:
				settings.customNameAllowance || roleBypassesCustomNameGate(principal),
		},
	};
}

/**
 * Settings overview: own (primary) identities, default identity, then shared.
 */
export async function listAccountIdentitiesOverview(
	db: Database,
	principal: Principal,
): Promise<AccountIdentitiesOverview> {
	if (!principal.accountId) {
		throw new IdentityAccessDeniedError();
	}
	return buildAccountIdentitiesOverview(db, principal, principal.accountId);
}

/**
 * Same overview shape as settings, for a target account (admin user edit dialog).
 */
export async function listAccountIdentitiesOverviewForAccount(
	db: Database,
	principal: Principal,
	accountId: string,
): Promise<AccountIdentitiesOverview> {
	await authorizeAccount(db, principal, accountId, "view");
	return buildAccountIdentitiesOverview(db, principal, accountId);
}

async function buildAccountIdentitiesOverview(
	db: Database,
	viewer: Principal,
	targetAccountId: string,
): Promise<AccountIdentitiesOverview> {
	const [target] = await db
		.select({
			id: accounts.id,
			primaryMailboxId: accounts.primaryMailboxId,
		})
		.from(accounts)
		.where(eq(accounts.id, targetAccountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}

	const profile = await loadProfileForAccount(db, targetAccountId);
	const settings = await getInstanceSettings(db);
	const primaryMailboxId = target.primaryMailboxId;
	const viewingSelf = viewer.accountId === targetAccountId;

	let own: IdentityDto[] = [];
	let defaultIdentity: IdentityDto | null = null;
	let canManageOwn = false;

	if (primaryMailboxId) {
		if (viewingSelf) {
			await assertPrincipalCanAccessMailbox(db, viewer, primaryMailboxId);
		}
		const rows = await db
			.select()
			.from(identities)
			.where(eq(identities.mailboxId, primaryMailboxId))
			.orderBy(asc(identities.createdAt));
		own = rows.map((row) =>
			toIdentityDto(
				{
					...row,
					namePattern: row.namePattern as IdentityNamePattern,
				},
				profile,
			),
		);
		defaultIdentity = toDefaultIdentityDto(settings, profile);
		try {
			await assertCanManageMailboxIdentities(db, viewer, primaryMailboxId);
			canManageOwn = true;
		} catch {
			canManageOwn = false;
		}
	}

	const sharedCandidateIds = viewingSelf
		? [...(await collectReadableMailboxIds(db, viewer))].filter(
				(id) => id !== primaryMailboxId,
			)
		: await loadAccountMailboxGrants(db, targetAccountId);

	const sharedGroups: AccountIdentitiesOverview["shared"] = [];

	if (sharedCandidateIds.length > 0) {
		const sharedMailboxes = await db
			.select({
				id: mailboxes.id,
				address: mailboxes.address,
				identityExport: mailboxes.identityExport,
			})
			.from(mailboxes)
			.where(
				and(
					inArray(mailboxes.id, sharedCandidateIds),
					eq(mailboxes.type, "shared"),
				),
			)
			.orderBy(asc(mailboxes.address));

		const sharedIds = sharedMailboxes.map((row) => row.id);
		const identityRows =
			sharedIds.length > 0
				? await db
						.select()
						.from(identities)
						.where(inArray(identities.mailboxId, sharedIds))
						.orderBy(asc(identities.createdAt))
				: [];

		const byMailbox = new Map<string, IdentityDto[]>();
		for (const row of identityRows) {
			const list = byMailbox.get(row.mailboxId) ?? [];
			list.push(
				toIdentityDto(
					{
						...row,
						namePattern: row.namePattern as IdentityNamePattern,
					},
					profile,
				),
			);
			byMailbox.set(row.mailboxId, list);
		}

		for (const mailbox of sharedMailboxes) {
			const mailboxIdentities = byMailbox.get(mailbox.id) ?? [];
			if (mailboxIdentities.length === 0) {
				continue;
			}
			sharedGroups.push({
				mailboxId: mailbox.id,
				mailboxAddress: mailbox.address,
				identityExport: mailbox.identityExport,
				identities: mailboxIdentities,
			});
		}
	}

	return {
		own,
		default: defaultIdentity,
		shared: sharedGroups,
		capabilities: {
			canManageOwn,
			customNameAllowed:
				settings.customNameAllowance || roleBypassesCustomNameGate(viewer),
			primaryMailboxId,
		},
	};
}

/**
 * Identities selectable when composing from `activeMailboxId`.
 */
export async function listAvailableIdentitiesForSend(
	db: Database,
	principal: Principal,
	activeMailboxId: string,
): Promise<IdentityDto[]> {
	await assertPrincipalCanAccessMailbox(db, principal, activeMailboxId);
	const active = await getMailboxRow(db, activeMailboxId);
	const profile = await loadProfileForAccount(db, principal.accountId);
	const result: IdentityDto[] = [];
	const seen = new Set<string>();

	const pushAll = (items: IdentityDto[]) => {
		for (const item of items) {
			if (seen.has(item.id)) {
				continue;
			}
			seen.add(item.id);
			result.push(item);
		}
	};

	const loadOwned = async (mailboxId: string) => {
		const rows = await db
			.select()
			.from(identities)
			.where(eq(identities.mailboxId, mailboxId))
			.orderBy(asc(identities.createdAt));
		return rows.map((row) =>
			toIdentityDto(
				{
					...row,
					namePattern: row.namePattern as IdentityNamePattern,
				},
				profile,
			),
		);
	};

	if (active.type === "primary") {
		const settings = await getInstanceSettings(db);
		pushAll([toDefaultIdentityDto(settings, profile)]);
	}

	pushAll(await loadOwned(activeMailboxId));

	if (
		active.type === "shared" &&
		active.personalIdentityAllowance &&
		principal.primaryMailboxId
	) {
		pushAll(await loadOwned(principal.primaryMailboxId));
	}

	if (principal.accountId) {
		const exportRows = await db
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(
				and(
					eq(mailboxes.identityExport, true),
					eq(mailboxes.type, "shared"),
				),
			);

		const exportIds = exportRows
			.map((row) => row.id)
			.filter((id) => id !== activeMailboxId);

		if (exportIds.length > 0) {
			const readable = await Promise.all(
				exportIds.map(async (id) => {
					try {
						await assertPrincipalCanAccessMailbox(db, principal, id);
						return id;
					} catch {
						return null;
					}
				}),
			);
			const allowedExportIds = readable.filter((id): id is string => id !== null);
			if (allowedExportIds.length > 0) {
				const rows = await db
					.select()
					.from(identities)
					.where(inArray(identities.mailboxId, allowedExportIds))
					.orderBy(asc(identities.createdAt));
				pushAll(
					rows.map((row) =>
						toIdentityDto(
							{
								...row,
								namePattern: row.namePattern as IdentityNamePattern,
							},
							profile,
						),
					),
				);
			}
		}
	}

	return result;
}

export async function createMailboxIdentity(
	db: Database,
	principal: Principal,
	mailboxId: string,
	input: IdentityInput,
): Promise<IdentityDto> {
	await assertCanManageMailboxIdentities(db, principal, mailboxId);
	const settings = await getInstanceSettings(db);
	assertCustomNameAllowed(principal, settings, input.namePattern);

	const normalized = normalizeCreateInput(input);
	const profile = await loadProfileForMailboxPreview(
		db,
		mailboxId,
		principal.accountId,
	);
	const now = new Date();
	const id = crypto.randomUUID();

	const [row] = await db
		.insert(identities)
		.values({
			id,
			mailboxId,
			namePattern: normalized.namePattern,
			customName: normalized.customName,
			signatureHtml: normalized.signatureHtml,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	return toIdentityDto(
		{
			...row,
			namePattern: row.namePattern as IdentityNamePattern,
		},
		profile,
	);
}

export async function updateMailboxIdentity(
	db: Database,
	principal: Principal,
	identityId: string,
	input: Partial<IdentityInput>,
): Promise<IdentityDto> {
	if (identityId === DEFAULT_IDENTITY_ID) {
		throw new IdentityAccessDeniedError("The default identity cannot be updated here");
	}

	const [existing] = await db
		.select()
		.from(identities)
		.where(eq(identities.id, identityId))
		.limit(1);
	if (!existing) {
		throw new Error("Identity not found");
	}

	await assertCanManageMailboxIdentities(db, principal, existing.mailboxId);
	const settings = await getInstanceSettings(db);
	const nextPattern =
		input.namePattern ?? (existing.namePattern as IdentityNamePattern);
	assertCustomNameAllowed(principal, settings, nextPattern);

	const patch = normalizePatchInput(input);
	if (
		nextPattern === "custom" &&
		(patch.customName === undefined ? existing.customName : patch.customName) ===
			null
	) {
		throw new IdentityValidationError("customName is required for custom pattern");
	}

	const now = new Date();
	const [row] = await db
		.update(identities)
		.set({
			...(patch.namePattern !== undefined
				? { namePattern: patch.namePattern }
				: {}),
			...(patch.customName !== undefined || patch.namePattern !== undefined
				? {
						customName:
							nextPattern === "custom"
								? (patch.customName !== undefined
										? patch.customName
										: existing.customName)
								: null,
					}
				: {}),
			...(patch.signatureHtml !== undefined
				? { signatureHtml: patch.signatureHtml }
				: {}),
			updatedAt: now,
		})
		.where(eq(identities.id, identityId))
		.returning();

	const profile = await loadProfileForMailboxPreview(
		db,
		existing.mailboxId,
		principal.accountId,
	);
	return toIdentityDto(
		{
			...row,
			namePattern: row.namePattern as IdentityNamePattern,
		},
		profile,
	);
}

export async function deleteMailboxIdentity(
	db: Database,
	principal: Principal,
	identityId: string,
): Promise<void> {
	if (identityId === DEFAULT_IDENTITY_ID) {
		throw new IdentityAccessDeniedError("The default identity cannot be deleted");
	}

	const [existing] = await db
		.select()
		.from(identities)
		.where(eq(identities.id, identityId))
		.limit(1);
	if (!existing) {
		throw new Error("Identity not found");
	}

	await assertCanManageMailboxIdentities(db, principal, existing.mailboxId);
	await db.delete(identities).where(eq(identities.id, identityId));
}

export async function resolveIdentityForSend(
	db: Database,
	principal: Principal,
	activeMailboxId: string,
	identityId: string | null | undefined,
): Promise<{
	identity: IdentityDto;
	fromName: string;
	signatureHtml: string | null;
}> {
	const available = await listAvailableIdentitiesForSend(
		db,
		principal,
		activeMailboxId,
	);
	let identity =
		identityId && identityId.length > 0
			? available.find((item) => item.id === identityId)
			: undefined;

	if (!identity) {
		identity = available[0];
	}
	if (!identity) {
		throw new IdentityValidationError("No identity available for this mailbox");
	}

	const profile = await loadProfileForAccount(db, principal.accountId);
	const fromName = resolveFromName(
		identity.namePattern,
		profile,
		identity.customName,
	);

	return {
		identity,
		fromName,
		signatureHtml: identity.signatureHtml,
	};
}

export function parseIdentityNamePattern(
	value: unknown,
): IdentityNamePattern | undefined {
	return isIdentityNamePattern(value) ? value : undefined;
}
