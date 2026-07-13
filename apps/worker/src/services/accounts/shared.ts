import { and, eq } from "drizzle-orm";

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
import { profilePictureFromProfile } from "./profile-picture";
import type { Principal } from "../../lib/auth/types";
import { isPlatformPrincipal } from "../../lib/auth/principal";
import {
	collectManageableMailboxIds,
	MailboxAccessDeniedError,
} from "../../lib/auth/mailbox-access";

export const PROFILE_LOCKABLE_FIELDS = [
	"firstName",
	"lastName",
	"recoveryAddress",
	"phone",
	"addressCountry",
	"addressState",
	"addressCity",
	"addressLine1",
	"addressLine2",
] as const;

export type ProfileLockableField = (typeof PROFILE_LOCKABLE_FIELDS)[number];

export type AccountProfileInput = {
	firstName?: string;
	lastName?: string;
	recoveryAddress?: string | null;
	phone?: string | null;
	addressCountry?: string | null;
	addressState?: string | null;
	addressCity?: string | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
};

export function toAccountListItem(
	row: typeof accounts.$inferSelect,
	profile: typeof accountProfiles.$inferSelect | null,
	domainId: string | null,
) {
	return {
		id: row.id,
		role: row.role,
		status: row.status,
		loginIdentifier: row.loginIdentifier,
		primaryMailboxId: row.primaryMailboxId,
		isIntendant: row.isIntendant,
		domainId,
		displayName: profile
			? `${profile.firstName} ${profile.lastName}`.trim() || row.loginIdentifier
			: row.loginIdentifier,
		profilePicture: profilePictureFromProfile(profile),
	};
}

export async function loadDomainAssignments(db: Database, accountId: string) {
	const rows = await db
		.select({ domainId: accountDomainAssignments.domainId })
		.from(accountDomainAssignments)
		.where(eq(accountDomainAssignments.accountId, accountId));
	return rows.map((row) => row.domainId);
}

export async function loadAccountMailboxGrants(db: Database, accountId: string) {
	const rows = await db
		.select({ mailboxId: mailboxGrants.mailboxId })
		.from(mailboxGrants)
		.where(eq(mailboxGrants.accountId, accountId));
	return rows.map((row) => row.mailboxId);
}

export function assertCanManageMailboxGrants(principal: Principal): void {
	if (isPlatformPrincipal(principal)) {
		return;
	}
	if (principal.role === "admin" || principal.role === "manager") {
		return;
	}
	throw new MailboxAccessDeniedError();
}

export async function loadManagerSharedMailboxAssignments(
	db: Database,
	accountId: string,
) {
	const rows = await db
		.select({
			domainId: managerSharedMailboxAssignments.domainId,
			mailboxId: managerSharedMailboxAssignments.mailboxId,
			allSharedMailboxes: managerSharedMailboxAssignments.allSharedMailboxes,
		})
		.from(managerSharedMailboxAssignments)
		.where(eq(managerSharedMailboxAssignments.accountId, accountId));
	return rows;
}

export function profileInputToPatch(input: AccountProfileInput) {
	return {
		firstName: input.firstName,
		lastName: input.lastName,
		recoveryAddress: input.recoveryAddress,
		phone: input.phone,
		addressCountry: input.addressCountry,
		addressState: input.addressState,
		addressCity: input.addressCity,
		addressLine1: input.addressLine1,
		addressLine2: input.addressLine2,
	};
}

export async function assertCanGrantOnSharedMailbox(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	if (isPlatformPrincipal(principal)) {
		const [mailbox] = await db
			.select({ type: mailboxes.type })
			.from(mailboxes)
			.where(eq(mailboxes.id, mailboxId))
			.limit(1);
		if (!mailbox || mailbox.type !== "shared") {
			throw new Error("Only shared mailboxes support grants");
		}
		return;
	}

	const manageable = await collectManageableMailboxIds(db, principal);
	if (!manageable.has(mailboxId)) {
		throw new MailboxAccessDeniedError(
			"You do not have permission to manage grants for this mailbox",
		);
	}

	const [mailbox] = await db
		.select({ type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox || mailbox.type !== "shared") {
		throw new Error("Only shared mailboxes support grants");
	}
}

export function assertCanManageManagerAssignments(principal: Principal): void {
	if (isPlatformPrincipal(principal) || principal.role === "admin") {
		return;
	}
	throw new MailboxAccessDeniedError(
		"You do not have permission to manage manager assignments",
	);
}
