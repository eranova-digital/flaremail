import type { Account } from "@/lib/auth/types";
import type { AccountRole, AccountSummary } from "@/lib/accounts/api";

export function canAccessManagementPage(account: Account | null): boolean {
	return canAccessAccountsTab(account);
}

export function canAccessAccountsTab(account: Account | null): boolean {
	if (!account) {
		return false;
	}
	return (
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin" ||
		account.role === "manager"
	);
}

export function inviteableRoles(account: Account | null): AccountRole[] {
	if (!account) {
		return [];
	}
	if (account.isIntendant) {
		return ["user", "manager", "admin", "superadmin"];
	}
	if (account.role === "superadmin") {
		return ["user", "manager", "admin"];
	}
	if (account.role === "admin") {
		return ["user", "manager"];
	}
	return ["user"];
}

export function canEditLocalPartPolicy(account: Account | null): boolean {
	return (
		!!account &&
		(account.isIntendant || account.role === "superadmin" || account.role === "admin")
	);
}

export function canRemoveTarget(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	if (!actor || target.isIntendant) {
		return false;
	}
	if (actor.isIntendant || actor.role === "superadmin") {
		return true;
	}
	if (actor.role === "admin") {
		return target.role !== "admin" && target.role !== "superadmin";
	}
	return false;
}

export function canSuspendTarget(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	if (!actor || target.isIntendant || actor.id === target.id) {
		return false;
	}
	if (actor.isIntendant || actor.role === "superadmin") {
		return true;
	}
	if (actor.role === "admin") {
		return target.role !== "admin" && target.role !== "superadmin";
	}
	if (actor.role === "manager") {
		return target.role === "user";
	}
	return false;
}

export function canAssignRoles(actor: Account | null): boolean {
	return (
		!!actor &&
		(actor.isIntendant || actor.role === "superadmin" || actor.role === "admin")
	);
}

export function canEditAccountDetails(
	actor: Account | null,
	targetId: string,
): boolean {
	if (!actor) {
		return false;
	}
	return actor.id === targetId || canAssignRoles(actor);
}

export function canEditOwnProfile(account: Account | null): boolean {
	return !!account && !account.isIntendant;
}

export function canRegisterDomains(account: Account | null): boolean {
	return !!account && (account.isIntendant || account.role === "superadmin");
}

export function canAccessDomainsTab(account: Account | null): boolean {
	return (
		!!account &&
		(account.isIntendant || account.role === "superadmin" || account.role === "admin")
	);
}

export function canManageMailboxes(account: Account | null): boolean {
	return canAccessDomainsTab(account);
}

export function canAccessMailboxesTab(account: Account | null): boolean {
	return canManageMailboxes(account) || account?.role === "manager";
}

export function showsManagerMailboxGrantsTab(account: Account | null): boolean {
	return account?.role === "manager";
}

export function canManageMailboxGrants(account: Account | null): boolean {
	return canManageSharedMailboxUsers(account);
}

export function canManageSharedMailboxUsers(account: Account | null): boolean {
	return (
		!!account &&
		(account.isIntendant ||
			account.role === "superadmin" ||
			account.role === "admin" ||
			account.role === "manager")
	);
}

export function canManageUserMailboxGrants(account: Account | null): boolean {
	return canAccessAccountsTab(account);
}

export function canLockProfileFields(actor: Account | null): boolean {
	return (
		!!actor &&
		(actor.isIntendant ||
			actor.role === "superadmin" ||
			actor.role === "admin" ||
			actor.role === "manager")
	);
}

export function canManageAssignments(actor: Account | null): boolean {
	return canAssignRoles(actor);
}

export function canManageManagerMailboxAssignments(
	account: Account | null,
): boolean {
	return canManageAssignments(account);
}

const ROLE_RANK: Record<AccountRole, number> = {
	user: 0,
	manager: 1,
	admin: 2,
	superadmin: 3,
};

function roleRank(role: AccountRole): number {
	return ROLE_RANK[role];
}

function actorRank(actor: Account): number {
	if (actor.isIntendant) {
		return 4;
	}
	if (
		actor.role === "user" ||
		actor.role === "manager" ||
		actor.role === "admin" ||
		actor.role === "superadmin"
	) {
		return roleRank(actor.role);
	}
	return -1;
}

function targetRank(target: AccountSummary): number {
	if (target.isIntendant) {
		return 5;
	}
	if (!target.role) {
		return -1;
	}
	return ROLE_RANK[target.role];
}

export function canManageTarget(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	if (!actor || target.isIntendant || actor.id === target.id) {
		return false;
	}
	if (actorRank(actor) <= targetRank(target)) {
		return false;
	}
	if (actor.isIntendant || actor.role === "superadmin") {
		return true;
	}
	if (actor.role === "admin") {
		return target.role !== "admin" && target.role !== "superadmin";
	}
	if (actor.role === "manager") {
		return target.role === "user";
	}
	return false;
}
