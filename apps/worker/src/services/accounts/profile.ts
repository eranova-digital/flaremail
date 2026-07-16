import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	mailboxGrants,
	mailboxes,
	managerSharedMailboxAssignments,
	profileFieldLocks,
} from "../../db/schema";
import { authorizeAccount } from "../../lib/auth/access";
import { isPlatformPrincipal } from "../../lib/auth/principal";
import { getInstanceSettings } from "../instance-settings";
import { assertRecoveryEmailCanBeRemoved } from "../security-compliance";
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
import type { Principal } from "../../lib/auth/types";

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

	return getAccountDetail(db, principal, accountId);
}
