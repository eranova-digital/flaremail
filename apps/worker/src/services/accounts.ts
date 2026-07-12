import { eq, inArray } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	domainLocalPartPolicies,
	domains,
	mailboxGrants,
	mailboxes,
	profileFieldLocks,
} from "../db/schema";
import type { AccountRole } from "../lib/auth/types";
import type { Principal } from "../lib/auth/types";
import {
	assertCanAssignInviteRole,
	assertCanManageAccount,
	assertCanRemoveAccount,
	assertCanViewAccount,
} from "../lib/auth/account-access";
import {
	accessibleMailboxIds,
	hasDomainAccess,
	isPlatformPrincipal,
} from "../lib/auth/principal";
import {
	applyLocalPartPattern,
	assertLocalPartMatchesPolicy,
	isValidMailboxLocalPart,
} from "../lib/local-part-policy";
import { createInviteRecord } from "./auth";
import { deleteMailboxCascade } from "./cascade-delete";
import { normalizeEmailAddress, parseEmailAddress } from "../lib/normalize-email-address";
import { isSystemManagedMailbox } from "../lib/system-mailboxes";

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

function toAccountListItem(
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
	};
}

async function loadProfileLocks(db: Database, accountId: string) {
	const rows = await db
		.select({ fieldName: profileFieldLocks.fieldName })
		.from(profileFieldLocks)
		.where(eq(profileFieldLocks.accountId, accountId));
	return rows.map((row) => row.fieldName);
}

async function loadDomainAssignments(db: Database, accountId: string) {
	const rows = await db
		.select({ domainId: accountDomainAssignments.domainId })
		.from(accountDomainAssignments)
		.where(eq(accountDomainAssignments.accountId, accountId));
	return rows.map((row) => row.domainId);
}

export async function listAccountsForPrincipal(db: Database, principal: Principal) {
	const rows = await db
		.select({
			account: accounts,
			profile: accountProfiles,
			domainId: mailboxes.domainId,
		})
		.from(accounts)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.leftJoin(mailboxes, eq(mailboxes.id, accounts.primaryMailboxId))
		.orderBy(accounts.loginIdentifier);

	if (!isPlatformPrincipal(principal)) {
		const domainIds = principal.domainIds;
		if (domainIds.length === 0) {
			return [];
		}
		return rows
			.filter(
				(row) =>
					row.domainId && domainIds.includes(row.domainId),
			)
			.map((row) =>
				toAccountListItem(row.account, row.profile, row.domainId),
			);
	}

	return rows.map((row) =>
		toAccountListItem(row.account, row.profile, row.domainId),
	);
}

export async function inviteAccount(
	db: Database,
	principal: Principal,
	input: {
		domainId: string;
		localPart: string;
		role?: AccountRole;
		firstName?: string;
		lastName?: string;
		recoveryAddress?: string | null;
		phone?: string | null;
		addressCountry?: string | null;
		addressState?: string | null;
		addressCity?: string | null;
		addressLine1?: string | null;
		addressLine2?: string | null;
		lockedFields?: string[];
		sendInviteEmail?: boolean;
	},
) {
	if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, input.domainId)) {
		throw new Error("Forbidden");
	}
	if (principal.role === "manager" && !principal.domainIds.includes(input.domainId)) {
		throw new Error("Forbidden");
	}

	const role = input.role ?? "user";
	assertCanAssignInviteRole(principal, role);

	const [domain] = await db
		.select()
		.from(domains)
		.where(eq(domains.id, input.domainId))
		.limit(1);
	if (!domain) {
		throw new Error("Domain not found");
	}

	const [policy] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domain.id))
		.limit(1);

	let localPart = input.localPart.trim().toLowerCase();
	const profileInput = {
		firstName: input.firstName,
		lastName: input.lastName,
	};

	if (policy?.enforced && policy.pattern) {
		if (principal.role === "manager") {
			assertLocalPartMatchesPolicy(
				localPart,
				policy.pattern,
				profileInput,
				true,
			);
		} else if (!localPart) {
			localPart = applyLocalPartPattern(policy.pattern, profileInput);
		}
	}

	if (!localPart || !isValidMailboxLocalPart(localPart)) {
		throw new Error("Invalid mailbox local part");
	}

	const address = `${localPart}@${normalizeEmailAddress(domain.name)}`;
	const parsed = parseEmailAddress(address);
	if (!parsed) {
		throw new Error("Invalid mailbox address");
	}

	const accountId = crypto.randomUUID();
	const mailboxId = crypto.randomUUID();
	const now = new Date();
	const lockedFields = new Set(
		(input.lockedFields ?? []).filter((field): field is ProfileLockableField =>
			(PROFILE_LOCKABLE_FIELDS as readonly string[]).includes(field),
		),
	);

	await db.transaction(async (tx) => {
		await tx.insert(mailboxes).values({
			id: mailboxId,
			domainId: domain.id,
			localPart: parsed.localPart,
			address,
			type: "primary",
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});

		await tx.insert(accounts).values({
			id: accountId,
			isIntendant: false,
			role,
			status: "pending",
			loginIdentifier: address,
			primaryMailboxId: mailboxId,
			createdAt: now,
			updatedAt: now,
		});

		await tx.insert(accountProfiles).values({
			accountId,
			firstName: input.firstName ?? "",
			lastName: input.lastName ?? "",
			recoveryAddress: input.recoveryAddress ?? null,
			phone: input.phone ?? null,
			addressCountry: input.addressCountry ?? null,
			addressState: input.addressState ?? null,
			addressCity: input.addressCity ?? null,
			addressLine1: input.addressLine1 ?? null,
			addressLine2: input.addressLine2 ?? null,
			updatedAt: now,
		});

		if (lockedFields.size > 0) {
			await tx.insert(profileFieldLocks).values(
				[...lockedFields].map((fieldName) => ({
					accountId,
					fieldName,
				})),
			);
		}

		if (role === "admin" || role === "manager") {
			await tx.insert(accountDomainAssignments).values({
				accountId,
				domainId: domain.id,
			});
		}
	});

	const inviteCode = await createInviteRecord(db, {
		accountId,
		createdByAccountId: principal.accountId!,
	});

	if (input.sendInviteEmail && input.recoveryAddress) {
		console.info(
			`[flaremail] Invite code for ${address}: ${inviteCode} (email to ${input.recoveryAddress} — external delivery not yet wired)`,
		);
	}

	return { accountId, mailboxId, address, inviteCode };
}

export async function assignRole(
	db: Database,
	principal: Principal,
	input: {
		accountId: string;
		role: AccountRole;
		domainIds?: string[];
	},
) {
	await assertCanManageAccount(db, principal, input.accountId);
	assertCanAssignInviteRole(principal, input.role);

	if (principal.role === "admin" && input.domainIds?.length) {
		for (const domainId of input.domainIds) {
			if (!principal.domainIds.includes(domainId)) {
				throw new Error("Forbidden");
			}
		}
	}

	await db
		.update(accounts)
		.set({ role: input.role, updatedAt: new Date() })
		.where(eq(accounts.id, input.accountId));

	if (input.domainIds?.length) {
		await db
			.delete(accountDomainAssignments)
			.where(eq(accountDomainAssignments.accountId, input.accountId));
		await db.insert(accountDomainAssignments).values(
			input.domainIds.map((domainId) => ({
				accountId: input.accountId,
				domainId,
			})),
		);
	}
}

export async function suspendAccount(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await assertCanManageAccount(db, principal, accountId);

	const [target] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}
	if (target.isIntendant) {
		throw new Error("Cannot suspend intendant");
	}
	if (target.role === "admin" || target.role === "superadmin") {
		if (!isPlatformPrincipal(principal) && principal.role !== "admin") {
			throw new Error("Managers cannot suspend admins");
		}
	}

	const now = new Date();
	await db
		.update(accounts)
		.set({ status: "suspended", suspendedAt: now, updatedAt: now })
		.where(eq(accounts.id, accountId));
}

export async function filterMailboxesForPrincipal<
	T extends {
		id: string;
		type: string;
		localPart?: string | null;
		isSystemManaged?: boolean;
	},
>(db: Database, principal: Principal, rows: T[]): Promise<T[]> {
	if (principal.isIntendant) {
		return rows.filter((row) => isSystemManagedMailbox(row));
	}

	if (principal.role === "superadmin") {
		return rows;
	}
	const allowed = accessibleMailboxIds(principal);
	if (principal.role === "admin") {
		const adminMailboxes = await db
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(inArray(mailboxes.domainId, principal.domainIds));
		for (const row of adminMailboxes) {
			allowed.add(row.id);
		}
	}
	return rows.filter((row) => allowed.has(row.id));
}

export async function getAccountDetail(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await assertCanViewAccount(db, principal, accountId);

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
		lockedFields,
		domainIds,
	};
}

function profileInputToPatch(input: AccountProfileInput) {
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
		await assertCanManageAccount(db, principal, accountId);
	}

	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account) {
		throw new Error("Account not found");
	}

	const existingLocks = new Set(await loadProfileLocks(db, accountId));
	const canManageLocks = !isSelf && (isPlatformPrincipal(principal) || principal.role === "admin");

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
			if (isSelf && existingLocks.has(field)) {
				continue;
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

	if (input.lockedFields && canManageLocks) {
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

export async function unsuspendAccount(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await assertCanManageAccount(db, principal, accountId);
	const now = new Date();
	await db
		.update(accounts)
		.set({ status: "active", suspendedAt: null, updatedAt: now })
		.where(eq(accounts.id, accountId));
}

export async function removeAccount(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	accountId: string,
) {
	const [target] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}

	if (principal.accountId !== accountId) {
		await assertCanManageAccount(db, principal, accountId);
	}
	assertCanRemoveAccount(principal, target);

	if (target.primaryMailboxId) {
		await deleteMailboxCascade(db, bucket, target.primaryMailboxId);
	}

	await db.delete(accounts).where(eq(accounts.id, accountId));
}

export async function getDomainLocalPartPolicy(db: Database, domainId: string) {
	const [policy] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domainId))
		.limit(1);
	return {
		domainId,
		enforced: policy?.enforced ?? false,
		pattern: policy?.pattern ?? null,
	};
}

export async function updateDomainLocalPartPolicy(
	db: Database,
	principal: Principal,
	domainId: string,
	input: { enforced?: boolean; pattern?: string | null },
) {
	if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, domainId)) {
		throw new Error("Forbidden");
	}
	if (principal.role === "manager") {
		throw new Error("Forbidden");
	}

	const now = new Date();
	const [existing] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domainId))
		.limit(1);

	if (existing) {
		await db
			.update(domainLocalPartPolicies)
			.set({
				enforced: input.enforced ?? existing.enforced,
				pattern:
					input.pattern === undefined ? existing.pattern : input.pattern,
				updatedAt: now,
			})
			.where(eq(domainLocalPartPolicies.domainId, domainId));
	} else {
		await db.insert(domainLocalPartPolicies).values({
			domainId,
			enforced: input.enforced ?? false,
			pattern: input.pattern ?? null,
			updatedAt: now,
		});
	}

	return getDomainLocalPartPolicy(db, domainId);
}

export async function suggestInviteLocalPart(
	db: Database,
	domainId: string,
	profile: { firstName?: string; lastName?: string },
): Promise<string | null> {
	const [policy] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domainId))
		.limit(1);
	if (!policy?.pattern) {
		return null;
	}
	const suggested = applyLocalPartPattern(policy.pattern, profile);
	return suggested && isValidMailboxLocalPart(suggested) ? suggested : null;
}

export async function grantMailboxAccess(
	db: Database,
	accountId: string,
	mailboxId: string,
) {
	await db.insert(mailboxGrants).values({ accountId, mailboxId });
}
