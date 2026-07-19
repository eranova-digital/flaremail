import { and, asc, eq, isNotNull } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountProfiles,
	accounts,
	invites,
	mailboxes,
	profileFieldLocks,
} from "../../db/schema";
import { authorizeAccount } from "../../lib/auth/access";
import { isPlatformPrincipal } from "../../lib/auth/principal";
import type { Principal } from "../../lib/auth/types";
import { getInstanceSettings, assertRecoveryEmailCanBeRemoved } from "../instance-settings";
import type { LogContext } from "../../lib/logs/context";
import { safeEmitLog } from "../../lib/logs/emit";
import {
	PROFILE_LOCKABLE_FIELDS,
	type AccountProfileInput,
	type ProfileLockableField,
	loadAccountMailboxGrants,
	loadDomainAssignments,
	loadManagerSharedMailboxAssignments,
	profileInputToPatch,
	toAccountListItem,
} from "./shared";
import { toProfilePicturePayload } from "../../lib/profile-picture/payload";

export async function listAccountsForPrincipal(
	db: Database,
	principal: Principal,
) {
	const rows = await db
		.select({
			account: accounts,
			profile: accountProfiles,
			domainId: mailboxes.domainId,
		})
		.from(accounts)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.leftJoin(mailboxes, eq(mailboxes.id, accounts.primaryMailboxId))
		.where(eq(accounts.isIntendant, false))
		.orderBy(accounts.loginIdentifier);

	if (!isPlatformPrincipal(principal)) {
		const domainIds = principal.domainIds;
		if (domainIds.length === 0) {
			return [];
		}
		return rows
			.filter(
				(row) => row.domainId && domainIds.includes(row.domainId),
			)
			.map((row) =>
				toAccountListItem(row.account, row.profile, row.domainId),
			);
	}

	return rows.map((row) =>
		toAccountListItem(row.account, row.profile, row.domainId),
	);
}

export async function loadProfileLocks(db: Database, accountId: string) {
	const rows = await db
		.select({ fieldName: profileFieldLocks.fieldName })
		.from(profileFieldLocks)
		.where(eq(profileFieldLocks.accountId, accountId));
	return rows.map((row) => row.fieldName);
}

export async function getAccountDetail(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await authorizeAccount(db, principal, accountId, "view");

	const [row] = await db
		.select({
			account: accounts,
			profile: accountProfiles,
			domainId: mailboxes.domainId,
		})
		.from(accounts)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.leftJoin(mailboxes, eq(mailboxes.id, accounts.primaryMailboxId))
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!row) {
		throw new Error("Account not found");
	}

	const lockedFields = await loadProfileLocks(db, accountId);
	const domainIds = await loadDomainAssignments(db, accountId);
	const managerAssignments = await loadManagerSharedMailboxAssignments(db, accountId);
	const grantedMailboxIds = await loadAccountMailboxGrants(db, accountId);
	const invitedBy = await loadInvitedBy(db, accountId);

	return {
		...toAccountListItem(row.account, row.profile, row.domainId),
		profile: row.profile
			? {
					firstName: row.profile.firstName,
					lastName: row.profile.lastName,
					recoveryAddress: row.profile.recoveryAddress,
					phone: row.profile.phone,
					address: {
						country: row.profile.addressCountry,
						state: row.profile.addressState,
						city: row.profile.addressCity,
						line1: row.profile.addressLine1,
						line2: row.profile.addressLine2,
					},
				}
			: null,
		profilePicture: toProfilePicturePayload(row.profile?.profilePictureUpdatedAt),
		lockedFields,
		domainIds,
		allSharedMailboxes: managerAssignments.some((row) => row.allSharedMailboxes),
		sharedMailboxIds: managerAssignments
			.filter((row) => row.mailboxId)
			.map((row) => row.mailboxId as string),
		grantedMailboxIds,
		invitedBy,
	};
}

async function loadInvitedBy(db: Database, accountId: string) {
	const [usedInvite] = await db
		.select({ createdByAccountId: invites.createdByAccountId })
		.from(invites)
		.where(and(eq(invites.accountId, accountId), isNotNull(invites.usedAt)))
		.orderBy(asc(invites.usedAt))
		.limit(1);

	let createdByAccountId = usedInvite?.createdByAccountId;
	if (!createdByAccountId) {
		const [oldestInvite] = await db
			.select({ createdByAccountId: invites.createdByAccountId })
			.from(invites)
			.where(eq(invites.accountId, accountId))
			.orderBy(asc(invites.createdAt))
			.limit(1);
		createdByAccountId = oldestInvite?.createdByAccountId;
	}

	if (!createdByAccountId) {
		return null;
	}

	const [inviter] = await db
		.select({
			accountId: accounts.id,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt,
		})
		.from(accounts)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(eq(accounts.id, createdByAccountId))
		.limit(1);

	if (!inviter) {
		return {
			id: createdByAccountId,
			displayName: "Deleted account",
			loginIdentifier: createdByAccountId,
			profilePicture: toProfilePicturePayload(null),
			deleted: true as const,
		};
	}

	return {
		id: inviter.accountId,
		displayName:
			[inviter.firstName, inviter.lastName].filter(Boolean).join(" ").trim() ||
			inviter.loginIdentifier,
		loginIdentifier: inviter.loginIdentifier,
		profilePicture: toProfilePicturePayload(inviter.profilePictureUpdatedAt),
		deleted: false as const,
	};
}

export async function updateAccountProfile(
	db: Database,
	principal: Principal,
	accountId: string,
	input: {
		profile?: AccountProfileInput;
		lockedFields?: string[];
	},
	logContext?: LogContext | null,
) {
	const isSelf = principal.accountId === accountId;
	if (!isSelf) {
		await authorizeAccount(db, principal, accountId, "manage");
	}

	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account) {
		throw new Error("Account not found");
	}

	if (account.isIntendant && input.profile) {
		throw new Error("Intendant profile cannot be edited");
	}

	const existingLocks = new Set(await loadProfileLocks(db, accountId));
	const canManageLocks =
		!isSelf &&
		(isPlatformPrincipal(principal) ||
			principal.role === "admin" ||
			principal.role === "manager");

	if (input.profile) {
		const patch: Record<string, string | null> = {};
		const entries = Object.entries(profileInputToPatch(input.profile)) as [
			ProfileLockableField,
			string | null | undefined,
		][];

		for (const [field, value] of entries) {
			if (value === undefined) {
				continue;
			}
			if (principal.kind === "api_key" && field === "recoveryAddress") {
				continue;
			}
			if (isSelf && field === "recoveryAddress") {
				continue;
			}
			if (isSelf && existingLocks.has(field)) {
				continue;
			}
			if (field === "recoveryAddress" && (value === null || value === "")) {
				const settings = await getInstanceSettings(db);
				assertRecoveryEmailCanBeRemoved(account, settings);
			}
			patch[field] = value;
		}

		if (Object.keys(patch).length > 0) {
			await db
				.update(accountProfiles)
				.set({ ...patch, updatedAt: new Date() })
				.where(eq(accountProfiles.accountId, accountId));
		}
	}

	if (input.lockedFields && canManageLocks && principal.kind !== "api_key") {
		const nextLocks = input.lockedFields.filter((field): field is ProfileLockableField =>
			(PROFILE_LOCKABLE_FIELDS as readonly string[]).includes(field),
		);
		await db
			.delete(profileFieldLocks)
			.where(eq(profileFieldLocks.accountId, accountId));
		if (nextLocks.length > 0) {
			await db.insert(profileFieldLocks).values(
				nextLocks.map((fieldName) => ({
					accountId,
					fieldName,
				})),
			);
		}
	}

	const actorAccountId = principal.accountId;
	if (!isSelf && actorAccountId) {
		await safeEmitLog(db, {
			importance: 7,
			type: "accounts",
			summary: "{actor} updated {account}'s profile",
			refs: {
				actor: { kind: "account", id: actorAccountId },
				account: { kind: "account", id: accountId },
			},
			actorAccountId,
			context: logContext,
		});
	}

	return getAccountDetail(db, principal, accountId);
}
