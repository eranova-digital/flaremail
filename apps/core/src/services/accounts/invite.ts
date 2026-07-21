import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	domainLocalPartPolicies,
	domains,
	invites,
	mailboxes,
	managerSharedMailboxAssignments,
	profileFieldLocks,
} from "../../db/schema";
import type { AccountRole, Principal } from "../../lib/auth/types";
import { authorizeAccount } from "../../lib/auth/access";
import { hasDomainAccess, isPlatformPrincipal } from "../../lib/auth/principal";
import {
	getProfileFieldsUsedByPattern,
	resolveLocalPartForInvite,
} from "../../lib/local-part-policy";
import { createInviteRecord } from "../auth";
import { normalizeEmailAddress, parseEmailAddress } from "../../lib/normalize-email-address";
import { isUniqueViolation } from "../../lib/db/postgres-error";
import { assertValidPhoneNumber } from "../../lib/validate-phone";
import {
	sendInviteTransactionalEmail,
	type TransactionalEmailDeps,
} from "../../lib/auth/transactional-email";
import type { LogContext } from "../../lib/logs/context";
import { safeEmitLog } from "../../lib/logs/emit";
import {
	PROFILE_LOCKABLE_FIELDS,
	type ProfileLockableField,
} from "./shared";

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
	deps?: TransactionalEmailDeps,
	logContext?: LogContext | null,
) {
	if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, input.domainId)) {
		throw new Error("Forbidden");
	}
	if (principal.role === "manager" && !principal.domainIds.includes(input.domainId)) {
		throw new Error("Forbidden");
	}

	const phone = assertValidPhoneNumber(input.phone);

	const role = input.role ?? "user";
	await authorizeAccount(db, principal, "", "assign_invite_role", { inviteRole: role });

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

	const [existingMailbox] = await db
		.select({ id: mailboxes.id })
		.from(mailboxes)
		.where(eq(mailboxes.address, address))
		.limit(1);
	if (existingMailbox) {
		throw new Error("Mailbox already exists");
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

	try {
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
				phone: phone,
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
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new Error("Mailbox already exists");
		}
		throw error;
	}

	const { code: inviteCode, inviteId } = await createInviteRecord(db, {
		accountId,
		createdByAccountId: principal.accountId!,
	});

	if (input.sendInviteEmail && input.recoveryAddress && deps) {
		await sendInviteTransactionalEmail(db, deps, {
			domainName: domain.name,
			to: input.recoveryAddress.trim(),
			code: inviteCode,
		});
	}

	if (principal.accountId) {
		await safeEmitLog(db, {
			importance: 4,
			type: "invites",
			summary: "{actor} created invite for {account}",
			refs: {
				actor: { kind: "account", id: principal.accountId },
				account: { kind: "account", id: accountId },
				invite: { kind: "invite", id: inviteId },
			},
			actorAccountId: principal.accountId,
			context: logContext,
		});
	}

	return { accountId, mailboxId, address, inviteCode, inviteId };
}

export async function regenerateInviteCode(
	db: Database,
	principal: Principal,
	accountId: string,
	logContext?: LogContext | null,
) {
	await authorizeAccount(db, principal, accountId, "manage");

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

	const { code: inviteCode, inviteId } = await createInviteRecord(db, {
		accountId,
		createdByAccountId: principal.accountId,
	});

	if (principal.accountId) {
		await safeEmitLog(db, {
			importance: 5,
			type: "invites",
			summary: "{actor} regenerated invite code for {account}",
			refs: {
				actor: { kind: "account", id: principal.accountId },
				account: { kind: "account", id: accountId },
				invite: { kind: "invite", id: inviteId },
			},
			actorAccountId: principal.accountId,
			context: logContext,
		});
	}

	return { inviteCode, inviteId };
}
