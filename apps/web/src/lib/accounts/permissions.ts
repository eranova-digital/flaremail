import type { Account } from "@/lib/auth/types";
import type { AccountRole, AccountSummary } from "@/lib/accounts/api";

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

export function canLockProfileFields(actor: Account | null): boolean {
	return (
		!!actor &&
		(actor.isIntendant || actor.role === "superadmin" || actor.role === "admin")
	);
}
