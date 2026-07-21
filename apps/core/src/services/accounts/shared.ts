import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	mailboxGrants,
	mailboxes,
	managerSharedMailboxAssignments,
} from "../../db/schema";
import { toProfilePicturePayload } from "../../lib/profile-picture/payload";
import {
	authorize,
	authorizeMailbox,
} from "../../lib/auth/access";
import type { Principal } from "../../lib/auth/types";
import { assertValidPhoneNumber } from "../../lib/validate-phone";

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
		profilePicture: toProfilePicturePayload(profile?.profilePictureUpdatedAt ?? null),
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
	authorize(principal, "domain_manage_users");
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

function parseOptionalStringField(
	value: unknown,
): string | null | undefined {
	if (value === null) {
		return null;
	}
	if (typeof value === "string") {
		return value;
	}
	return undefined;
}

/**
 * Accepts either nested `address: { country, ... }` (profile PATCH) or flat
 * `addressCountry` / `addressLine1` keys (invite payload).
 */
export function parseProfileInput(value: Record<string, unknown>) {
	const address =
		value.address && typeof value.address === "object"
			? (value.address as Record<string, unknown>)
			: null;

	const fromAddressOrFlat = (
		nestedKey: "country" | "state" | "city" | "line1" | "line2",
		flatKey: string,
	): string | null | undefined => {
		if (address) {
			return parseOptionalStringField(address[nestedKey]);
		}
		return parseOptionalStringField(value[flatKey]);
	};

	return {
		firstName:
			typeof value.firstName === "string" ? value.firstName : undefined,
		lastName: typeof value.lastName === "string" ? value.lastName : undefined,
		recoveryAddress:
			value.recoveryAddress === null
				? null
				: typeof value.recoveryAddress === "string"
					? value.recoveryAddress
					: undefined,
		phone:
			value.phone === null
				? null
				: typeof value.phone === "string"
					? assertValidPhoneNumber(value.phone)
					: undefined,
		addressCountry: fromAddressOrFlat("country", "addressCountry"),
		addressState: fromAddressOrFlat("state", "addressState"),
		addressCity: fromAddressOrFlat("city", "addressCity"),
		addressLine1: fromAddressOrFlat("line1", "addressLine1"),
		addressLine2: fromAddressOrFlat("line2", "addressLine2"),
	};
}

export async function assertCanGrantOnSharedMailbox(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	await authorizeMailbox(db, principal, mailboxId, "manage");

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
	authorize(principal, "domain_admin");
}
