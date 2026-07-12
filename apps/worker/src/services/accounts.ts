import { eq, inArray } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	domains,
	mailboxGrants,
	mailboxes,
} from "../db/schema";
import type { AccountRole } from "../lib/auth/types";
import type { Principal } from "../lib/auth/types";
import {
	accessibleMailboxIds,
	hasDomainAccess,
	isPlatformPrincipal,
} from "../lib/auth/principal";
import { createInviteRecord } from "./auth";
import { normalizeEmailAddress, parseEmailAddress } from "../lib/normalize-email-address";
import { provisionSystemMailboxes } from "../lib/system-mailboxes";

export async function listAccountsForPrincipal(db: Database, principal: Principal) {
	let rows = await db.select().from(accounts).orderBy(accounts.loginIdentifier);
	if (!isPlatformPrincipal(principal)) {
		const domainIds = principal.domainIds;
		if (domainIds.length === 0) {
			return [];
		}
		const mailboxRows = await db
			.select({ accountId: accounts.id })
			.from(accounts)
			.innerJoin(mailboxes, eq(mailboxes.id, accounts.primaryMailboxId))
			.where(inArray(mailboxes.domainId, domainIds));
		const allowed = new Set(mailboxRows.map((row) => row.accountId));
		rows = rows.filter((row) => allowed.has(row.id));
	}
	return rows.map((row) => ({
		id: row.id,
		role: row.role,
		status: row.status,
		loginIdentifier: row.loginIdentifier,
		primaryMailboxId: row.primaryMailboxId,
		isIntendant: row.isIntendant,
	}));
}

export async function inviteAccount(
	db: Database,
	principal: Principal,
	input: {
		domainId: string;
		localPart: string;
		firstName?: string;
		lastName?: string;
		recoveryAddress?: string;
		sendInviteEmail?: boolean;
	},
) {
	if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, input.domainId)) {
		throw new Error("Forbidden");
	}
	if (principal.role === "manager" && !principal.domainIds.includes(input.domainId)) {
		throw new Error("Forbidden");
	}

	const [domain] = await db
		.select()
		.from(domains)
		.where(eq(domains.id, input.domainId))
		.limit(1);
	if (!domain) {
		throw new Error("Domain not found");
	}

	const localPart = input.localPart.trim().toLowerCase();
	const address = `${localPart}@${normalizeEmailAddress(domain.name)}`;
	const parsed = parseEmailAddress(address);
	if (!parsed) {
		throw new Error("Invalid mailbox address");
	}

	const accountId = crypto.randomUUID();
	const mailboxId = crypto.randomUUID();
	const now = new Date();

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
			role: "user",
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
			updatedAt: now,
		});
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
	if (principal.isIntendant) {
		// intendant can assign any role including superadmin
	} else if (principal.role === "superadmin") {
		if (input.role === "superadmin") {
			throw new Error("Superadmins cannot create other superadmins");
		}
	} else if (principal.role === "admin") {
		if (input.role !== "user" && input.role !== "manager") {
			throw new Error("Admins can only assign user or manager roles");
		}
	} else {
		throw new Error("Forbidden");
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

export async function filterMailboxesForPrincipal<T extends { id: string }>(
	db: Database,
	principal: Principal,
	rows: T[],
): Promise<T[]> {
	if (isPlatformPrincipal(principal)) {
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

export async function grantMailboxAccess(
	db: Database,
	accountId: string,
	mailboxId: string,
) {
	await db.insert(mailboxGrants).values({ accountId, mailboxId });
}
