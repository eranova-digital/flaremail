import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accounts, identities, mailboxes } from "../../db/schema";
import {
	authorizeAccount,
	authorizeMailbox,
	collectManageableMailboxIds,
	collectReadableMailboxIds,
} from "../../lib/auth/access";
import { isPlatformPrincipal } from "../../lib/auth/principal";
import type { Principal } from "../../lib/auth/types";
import type { IdentityNamePattern } from "@test-worker/identity-name-pattern";
import { loadAccountMailboxGrants } from "../accounts/shared";
import { getInstanceSettings } from "../instance-settings";
import {
	type AccountIdentitiesOverview,
	assertCustomNameAllowed,
	DEFAULT_IDENTITY_ID,
	type IdentityDto,
	type IdentityInput,
	IdentityAccessDeniedError,
	IdentityValidationError,
	loadProfileForAccount,
	loadProfileForMailboxPreview,
	normalizeCreateInput,
	normalizePatchInput,
	roleBypassesCustomNameGate,
	toDefaultIdentityDto,
	toIdentityDto,
	getMailboxRow,
	type IdentityListResult,
} from "./shared";

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
	await authorizeMailbox(db, principal, mailboxId, "read");
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
			await authorizeMailbox(db, viewer, primaryMailboxId, "read");
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
