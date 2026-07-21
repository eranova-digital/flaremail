import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accounts, mailboxes } from "../../db/schema";
import type { AccountRole } from "./types";
import type { Principal } from "./types";
import { hasDomainAccess, isPlatformPrincipal } from "./principal";

export class AccountAccessDeniedError extends Error {
	constructor(message = "You do not have permission to manage this account") {
		super(message);
		this.name = "AccountAccessDeniedError";
	}
}

export async function getAccountPrimaryDomainId(
	db: Database,
	accountId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ domainId: mailboxes.domainId })
		.from(accounts)
		.innerJoin(mailboxes, eq(mailboxes.id, accounts.primaryMailboxId))
		.where(eq(accounts.id, accountId))
		.limit(1);
	return row?.domainId ?? null;
}

export async function canPrincipalViewAccount(
	db: Database,
	principal: Principal,
	targetAccountId: string,
): Promise<boolean> {
	if (principal.kind === "legacy") {
		return true;
	}
	if (isPlatformPrincipal(principal)) {
		return true;
	}
	if (!principal.accountId) {
		return false;
	}
	if (principal.accountId === targetAccountId) {
		return true;
	}
	const domainId = await getAccountPrimaryDomainId(db, targetAccountId);
	if (!domainId) {
		return principal.isIntendant;
	}
	return hasDomainAccess(principal, domainId);
}

export async function assertCanViewAccount(
	db: Database,
	principal: Principal,
	targetAccountId: string,
): Promise<void> {
	if (!(await canPrincipalViewAccount(db, principal, targetAccountId))) {
		throw new AccountAccessDeniedError();
	}
}

export async function assertCanManageAccount(
	db: Database,
	principal: Principal,
	targetAccountId: string,
): Promise<void> {
	if (principal.kind === "legacy") {
		return;
	}
	if (isPlatformPrincipal(principal)) {
		return;
	}
	if (!principal.accountId) {
		throw new AccountAccessDeniedError();
	}
	if (principal.accountId === targetAccountId) {
		return;
	}

	const [target] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, targetAccountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}
	if (target.isIntendant) {
		throw new AccountAccessDeniedError("The intendant account cannot be managed");
	}

	if (principalRank(principal) <= targetSecurityRank(target)) {
		throw new AccountAccessDeniedError();
	}

	const domainId = await getAccountPrimaryDomainId(db, targetAccountId);
	if (!domainId || !hasDomainAccess(principal, domainId)) {
		throw new AccountAccessDeniedError();
	}

	if (principal.role === "manager") {
		if (target.role === "admin" || target.role === "superadmin") {
			throw new AccountAccessDeniedError();
		}
		return;
	}

	if (principal.role === "admin") {
		if (target.role === "admin" || target.role === "superadmin") {
			throw new AccountAccessDeniedError();
		}
		return;
	}

	throw new AccountAccessDeniedError();
}

export function assertCanAssignInviteRole(
	principal: Principal,
	role: AccountRole,
): void {
	if (isPlatformPrincipal(principal)) {
		if (principal.role === "superadmin" && role === "superadmin") {
			throw new AccountAccessDeniedError("Superadmins cannot create other superadmins");
		}
		return;
	}
	if (principal.isIntendant) {
		return;
	}
	if (principal.role === "superadmin") {
		if (role === "superadmin") {
			throw new AccountAccessDeniedError("Superadmins cannot create other superadmins");
		}
		return;
	}
	if (principal.role === "admin") {
		if (role !== "user" && role !== "manager") {
			throw new AccountAccessDeniedError("Admins can only invite users or managers");
		}
		return;
	}
	if (principal.role === "manager") {
		if (role !== "user") {
			throw new AccountAccessDeniedError("Managers can only invite users");
		}
		return;
	}
	throw new AccountAccessDeniedError();
}

const ROLE_RANK: Record<AccountRole, number> = {
	user: 0,
	manager: 1,
	admin: 2,
	superadmin: 3,
};

function principalRank(principal: Principal): number {
	if (principal.isIntendant) {
		return 4;
	}
	if (
		principal.role === "user" ||
		principal.role === "manager" ||
		principal.role === "admin" ||
		principal.role === "superadmin"
	) {
		return ROLE_RANK[principal.role];
	}
	return -1;
}

function targetSecurityRank(target: {
	isIntendant: boolean;
	role: AccountRole | null;
}): number {
	if (target.isIntendant) {
		return 5;
	}
	if (!target.role) {
		return -1;
	}
	return ROLE_RANK[target.role];
}

export async function assertCanManageTargetSecurity(
	db: Database,
	principal: Principal,
	targetAccountId: string,
): Promise<void> {
	if (principal.kind === "legacy") {
		return;
	}
	if (isPlatformPrincipal(principal)) {
		return;
	}
	if (!principal.accountId) {
		throw new AccountAccessDeniedError();
	}
	if (principal.accountId === targetAccountId) {
		throw new AccountAccessDeniedError();
	}

	const [target] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, targetAccountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}
	if (target.isIntendant) {
		throw new AccountAccessDeniedError("The intendant account cannot be managed");
	}

	if (principalRank(principal) <= targetSecurityRank(target)) {
		throw new AccountAccessDeniedError();
	}

	const domainId = await getAccountPrimaryDomainId(db, targetAccountId);
	if (!domainId || !hasDomainAccess(principal, domainId)) {
		throw new AccountAccessDeniedError();
	}

	if (principal.role === "admin") {
		if (target.role === "admin" || target.role === "superadmin") {
			throw new AccountAccessDeniedError();
		}
		return;
	}

	if (principal.role === "manager") {
		if (target.role !== "user") {
			throw new AccountAccessDeniedError();
		}
		return;
	}

	throw new AccountAccessDeniedError();
}

export function assertCanRemoveAccount(
	principal: Principal,
	target: { isIntendant: boolean; role: AccountRole | null },
): void {
	if (target.isIntendant) {
		throw new AccountAccessDeniedError("The intendant account cannot be removed");
	}
	if (principal.kind === "legacy" || isPlatformPrincipal(principal)) {
		return;
	}
	if (principal.role === "manager") {
		throw new AccountAccessDeniedError("Managers cannot remove accounts");
	}
	if (principal.role === "admin") {
		if (target.role === "admin" || target.role === "superadmin") {
			throw new AccountAccessDeniedError("Admins cannot remove admin accounts");
		}
		return;
	}
	throw new AccountAccessDeniedError();
}
