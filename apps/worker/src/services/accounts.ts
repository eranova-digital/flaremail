import { and, eq, isNull, ne } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	domainLocalPartPolicies,
	domains,
	invites,
	mailboxGrants,
	mailboxes,
	managerSharedMailboxAssignments,
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
import { hasDomainAccess, isPlatformPrincipal } from "../lib/auth/principal";
import {
	collectManageableMailboxIds,
	MailboxAccessDeniedError,
} from "../lib/auth/mailbox-access";
import {
	applyLocalPartPattern,
	generatePatternRandomValues,
	getProfileFieldsUsedByPattern,
	isValidMailboxLocalPart,
	resolveLocalPartForInvite,
} from "../lib/local-part-policy";
import { createInviteRecord } from "./auth";
import { deleteMailboxCascade } from "./cascade-delete";
import { normalizeEmailAddress, parseEmailAddress } from "../lib/normalize-email-address";

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

export async function loadProfileLocks(db: Database, accountId: string) {
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

async function loadAccountMailboxGrants(db: Database, accountId: string) {
	const rows = await db
		.select({ mailboxId: mailboxGrants.mailboxId })
		.from(mailboxGrants)
		.where(eq(mailboxGrants.accountId, accountId));
	return rows.map((row) => row.mailboxId);
}

function assertCanManageMailboxGrants(principal: Principal): void {
	if (isPlatformPrincipal(principal)) {
		return;
	}
	if (principal.role === "admin" || principal.role === "manager") {
		return;
	}
	throw new MailboxAccessDeniedError();
}

async function loadManagerSharedMailboxAssignments(db: Database, accountId: string) {
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
		assignedDomainIds?: string[];
		sharedMailboxIds?: string[];
		allSharedMailboxes?: boolean;
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

	const profileInput = {
		firstName: input.firstName,
		lastName: input.lastName,
	};

	const { localPart } = resolveLocalPartForInvite({
		pattern: policy?.pattern ?? null,
		enforced: policy?.enforced ?? false,
		inviterIsManager: principal.role === "manager",
		profile: profileInput,
		requestedLocalPart: input.localPart,
	});

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

	if (principal.role === "manager" && policy?.enforced && policy.pattern) {
		for (const field of getProfileFieldsUsedByPattern(policy.pattern)) {
			lockedFields.add(field);
		}
	}

	const assignmentDomainIds =
		input.assignedDomainIds?.length && (role === "admin" || role === "manager")
			? input.assignedDomainIds
			: role === "admin" || role === "manager"
				? [domain.id]
				: [];

	for (const assignmentDomainId of assignmentDomainIds) {
		if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, assignmentDomainId)) {
			throw new Error("Forbidden domain assignment");
		}
	}

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

		for (const assignmentDomainId of assignmentDomainIds) {
			await tx.insert(accountDomainAssignments).values({
				accountId,
				domainId: assignmentDomainId,
			});
		}

		if (role === "manager") {
			if (input.allSharedMailboxes) {
				for (const assignmentDomainId of assignmentDomainIds) {
					await tx.insert(managerSharedMailboxAssignments).values({
						accountId,
						domainId: assignmentDomainId,
						mailboxId: null,
						allSharedMailboxes: true,
					});
				}
			} else if (input.sharedMailboxIds?.length) {
				for (const sharedMailboxId of input.sharedMailboxIds) {
					const [sharedMailbox] = await tx
						.select({ domainId: mailboxes.domainId, type: mailboxes.type })
						.from(mailboxes)
						.where(eq(mailboxes.id, sharedMailboxId))
						.limit(1);
					if (!sharedMailbox || sharedMailbox.type !== "shared") {
						throw new Error("Invalid shared mailbox assignment");
					}
					if (
						!isPlatformPrincipal(principal) &&
						!hasDomainAccess(principal, sharedMailbox.domainId)
					) {
						throw new Error("Forbidden shared mailbox assignment");
					}
					await tx.insert(managerSharedMailboxAssignments).values({
						accountId,
						domainId: sharedMailbox.domainId,
						mailboxId: sharedMailboxId,
						allSharedMailboxes: false,
					});
				}
			}
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
		lockedFields,
		domainIds,
		allSharedMailboxes: managerAssignments.some((row) => row.allSharedMailboxes),
		sharedMailboxIds: managerAssignments
			.filter((row) => row.mailboxId)
			.map((row) => row.mailboxId as string),
		grantedMailboxIds,
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

export async function updateAccountAssignments(
	db: Database,
	principal: Principal,
	accountId: string,
	input: {
		domainIds?: string[];
		allSharedMailboxes?: boolean;
		sharedMailboxIds?: string[];
		grantedMailboxIds?: string[];
	},
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
		throw new Error("Cannot update intendant assignments");
	}

	if (input.grantedMailboxIds !== undefined) {
		if (target.role !== "user") {
			throw new Error("Mailbox grants only apply to user accounts");
		}
		assertCanManageMailboxGrants(principal);
		for (const mailboxId of input.grantedMailboxIds) {
			await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
		}
		await db
			.delete(mailboxGrants)
			.where(eq(mailboxGrants.accountId, accountId));
		for (const mailboxId of input.grantedMailboxIds) {
			await grantMailboxAccess(db, accountId, mailboxId);
		}
		return getAccountDetail(db, principal, accountId);
	}

	if (target.role !== "admin" && target.role !== "manager") {
		throw new Error("Assignments only apply to admin or manager accounts");
	}

	if (input.domainIds !== undefined) {
		for (const domainId of input.domainIds) {
			if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, domainId)) {
				throw new Error("Forbidden domain assignment");
			}
		}

		await db
			.delete(accountDomainAssignments)
			.where(eq(accountDomainAssignments.accountId, accountId));

		if (input.domainIds.length > 0) {
			await db.insert(accountDomainAssignments).values(
				input.domainIds.map((domainId) => ({
					accountId,
					domainId,
				})),
			);
		}
	}

	if (
		target.role === "manager" &&
		(input.allSharedMailboxes !== undefined || input.sharedMailboxIds !== undefined)
	) {
		const assignmentDomainIds =
			input.domainIds ?? (await loadDomainAssignments(db, accountId));

		await db
			.delete(managerSharedMailboxAssignments)
			.where(eq(managerSharedMailboxAssignments.accountId, accountId));

		if (input.allSharedMailboxes) {
			for (const assignmentDomainId of assignmentDomainIds) {
				await db.insert(managerSharedMailboxAssignments).values({
					accountId,
					domainId: assignmentDomainId,
					mailboxId: null,
					allSharedMailboxes: true,
				});
			}
		} else if (input.sharedMailboxIds?.length) {
			for (const sharedMailboxId of input.sharedMailboxIds) {
				const [sharedMailbox] = await db
					.select({ domainId: mailboxes.domainId, type: mailboxes.type })
					.from(mailboxes)
					.where(eq(mailboxes.id, sharedMailboxId))
					.limit(1);
				if (!sharedMailbox || sharedMailbox.type !== "shared") {
					throw new Error("Invalid shared mailbox assignment");
				}
				if (
					!isPlatformPrincipal(principal) &&
					!hasDomainAccess(principal, sharedMailbox.domainId)
				) {
					throw new Error("Forbidden shared mailbox assignment");
				}
				await db.insert(managerSharedMailboxAssignments).values({
					accountId,
					domainId: sharedMailbox.domainId,
					mailboxId: sharedMailboxId,
					allSharedMailboxes: false,
				});
			}
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
	inviterIsManager: boolean,
): Promise<string | null> {
	const [policy] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domainId))
		.limit(1);
	if (!policy?.pattern) {
		return null;
	}
	if (inviterIsManager && !policy.enforced) {
		return null;
	}
	const suggested = applyLocalPartPattern(
		policy.pattern,
		profile,
		generatePatternRandomValues(),
	);
	return suggested && isValidMailboxLocalPart(suggested) ? suggested : null;
}

export async function grantMailboxAccess(
	db: Database,
	accountId: string,
	mailboxId: string,
) {
	await db.insert(mailboxGrants).values({ accountId, mailboxId });
}

async function assertCanGrantOnSharedMailbox(
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

export async function listMailboxGrantHolders(
	db: Database,
	principal: Principal,
	mailboxId: string,
) {
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);

	const rows = await db
		.select({
			accountId: mailboxGrants.accountId,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			role: accounts.role,
			status: accounts.status,
		})
		.from(mailboxGrants)
		.innerJoin(accounts, eq(accounts.id, mailboxGrants.accountId))
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(eq(mailboxGrants.mailboxId, mailboxId));

	return rows.map((row) => ({
		accountId: row.accountId,
		loginIdentifier: row.loginIdentifier,
		displayName:
			[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
			row.loginIdentifier,
		role: row.role,
		status: row.status,
	}));
}

export async function grantSharedMailboxAccess(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
) {
	if (principal.role !== "manager" && principal.role !== "admin" && !isPlatformPrincipal(principal)) {
		throw new MailboxAccessDeniedError();
	}

	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await assertCanManageAccount(db, principal, accountId);

	const [target] = await db
		.select({ role: accounts.role })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target || target.role !== "user") {
		throw new Error("Shared mailbox access can only be granted to users");
	}

	await grantMailboxAccess(db, accountId, mailboxId);
}

export async function revokeSharedMailboxAccess(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
) {
	if (principal.role !== "manager" && principal.role !== "admin" && !isPlatformPrincipal(principal)) {
		throw new MailboxAccessDeniedError();
	}

	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await assertCanManageAccount(db, principal, accountId);

	await db
		.delete(mailboxGrants)
		.where(
			and(
				eq(mailboxGrants.accountId, accountId),
				eq(mailboxGrants.mailboxId, mailboxId),
			),
		);
}

function assertCanManageManagerAssignments(principal: Principal): void {
	if (isPlatformPrincipal(principal) || principal.role === "admin") {
		return;
	}
	throw new MailboxAccessDeniedError(
		"You do not have permission to manage manager assignments",
	);
}

export async function listMailboxManagerAssignments(
	db: Database,
	principal: Principal,
	mailboxId: string,
) {
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	assertCanManageManagerAssignments(principal);

	const [mailbox] = await db
		.select({ domainId: mailboxes.domainId, type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox || mailbox.type !== "shared") {
		throw new Error("Only shared mailboxes support manager assignments");
	}

	const rows = await db
		.select({
			accountId: managerSharedMailboxAssignments.accountId,
			mailboxId: managerSharedMailboxAssignments.mailboxId,
			allSharedMailboxes: managerSharedMailboxAssignments.allSharedMailboxes,
			domainId: managerSharedMailboxAssignments.domainId,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			role: accounts.role,
			status: accounts.status,
		})
		.from(managerSharedMailboxAssignments)
		.innerJoin(
			accounts,
			eq(accounts.id, managerSharedMailboxAssignments.accountId),
		)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(
			and(
				eq(accounts.role, "manager"),
				eq(accounts.status, "active"),
			),
		);

	const holders = new Map<
		string,
		{
			accountId: string;
			loginIdentifier: string;
			displayName: string;
			role: AccountRole;
			status: string;
			viaAllShared: boolean;
		}
	>();

	for (const row of rows) {
		const coversMailbox =
			row.mailboxId === mailboxId ||
			(row.allSharedMailboxes && row.domainId === mailbox.domainId);
		if (!coversMailbox) {
			continue;
		}

		const existing = holders.get(row.accountId);
		const viaAllShared = row.allSharedMailboxes;
		if (existing) {
			holders.set(row.accountId, {
				...existing,
				viaAllShared: existing.viaAllShared || viaAllShared,
			});
			continue;
		}

		holders.set(row.accountId, {
			accountId: row.accountId,
			loginIdentifier: row.loginIdentifier,
			displayName:
				[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
				row.loginIdentifier,
			role: row.role as AccountRole,
			status: row.status,
			viaAllShared,
		});
	}

	return [...holders.values()].sort((left, right) =>
		left.displayName.localeCompare(right.displayName),
	);
}

export async function grantManagerMailboxAssignment(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
) {
	assertCanManageManagerAssignments(principal);
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await assertCanManageAccount(db, principal, accountId);

	const [target] = await db
		.select({ role: accounts.role })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target || target.role !== "manager") {
		throw new Error("Manager assignments only apply to manager accounts");
	}

	const [mailbox] = await db
		.select({ domainId: mailboxes.domainId, type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox || mailbox.type !== "shared") {
		throw new Error("Only shared mailboxes support manager assignments");
	}

	const assignments = await loadManagerSharedMailboxAssignments(db, accountId);
	if (
		assignments.some(
			(assignment) =>
				assignment.allSharedMailboxes &&
				assignment.domainId === mailbox.domainId,
		)
	) {
		return;
	}
	if (assignments.some((assignment) => assignment.mailboxId === mailboxId)) {
		return;
	}

	await db.insert(managerSharedMailboxAssignments).values({
		accountId,
		domainId: mailbox.domainId,
		mailboxId,
		allSharedMailboxes: false,
	});
}

export async function revokeManagerMailboxAssignment(
	db: Database,
	principal: Principal,
	accountId: string,
	mailboxId: string,
) {
	assertCanManageManagerAssignments(principal);
	await assertCanGrantOnSharedMailbox(db, principal, mailboxId);
	await assertCanManageAccount(db, principal, accountId);

	const [target] = await db
		.select({ role: accounts.role })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target || target.role !== "manager") {
		throw new Error("Manager assignments only apply to manager accounts");
	}

	const [mailbox] = await db
		.select({ domainId: mailboxes.domainId, type: mailboxes.type })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
	if (!mailbox || mailbox.type !== "shared") {
		throw new Error("Only shared mailboxes support manager assignments");
	}

	const assignments = await loadManagerSharedMailboxAssignments(db, accountId);
	const hasAllShared = assignments.some(
		(assignment) =>
			assignment.allSharedMailboxes &&
			assignment.domainId === mailbox.domainId,
	);
	const hasExplicit = assignments.some(
		(assignment) => assignment.mailboxId === mailboxId,
	);

	if (!hasAllShared && !hasExplicit) {
		return;
	}

	if (hasAllShared) {
		await db
			.delete(managerSharedMailboxAssignments)
			.where(eq(managerSharedMailboxAssignments.accountId, accountId));

		for (const assignment of assignments) {
			if (assignment.allSharedMailboxes) {
				const sharedInDomain = await db
					.select({ id: mailboxes.id, domainId: mailboxes.domainId })
					.from(mailboxes)
					.where(
						and(
							eq(mailboxes.domainId, assignment.domainId),
							eq(mailboxes.type, "shared"),
							ne(mailboxes.id, mailboxId),
						),
					);
				for (const sharedMailbox of sharedInDomain) {
					await db.insert(managerSharedMailboxAssignments).values({
						accountId,
						domainId: sharedMailbox.domainId,
						mailboxId: sharedMailbox.id,
						allSharedMailboxes: false,
					});
				}
				continue;
			}

			if (assignment.mailboxId && assignment.mailboxId !== mailboxId) {
				await db.insert(managerSharedMailboxAssignments).values({
					accountId,
					domainId: assignment.domainId,
					mailboxId: assignment.mailboxId,
					allSharedMailboxes: false,
				});
			}
		}
		return;
	}

	await db
		.delete(managerSharedMailboxAssignments)
		.where(
			and(
				eq(managerSharedMailboxAssignments.accountId, accountId),
				eq(managerSharedMailboxAssignments.mailboxId, mailboxId),
			),
		);
}

export async function regenerateInviteCode(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await assertCanManageAccount(db, principal, accountId);

	const [target] = await db
		.select({ status: accounts.status })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}
	if (target.status !== "pending") {
		throw new Error("Invite codes can only be regenerated for pending accounts");
	}
	if (!principal.accountId) {
		throw new Error("Authentication required");
	}

	await db
		.delete(invites)
		.where(and(eq(invites.accountId, accountId), isNull(invites.usedAt)));

	const inviteCode = await createInviteRecord(db, {
		accountId,
		createdByAccountId: principal.accountId,
	});

	return { inviteCode };
}
