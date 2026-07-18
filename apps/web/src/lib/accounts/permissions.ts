import type { Account, AccountCapabilities } from "@/lib/auth/types";
import type { AccountRole, AccountSummary } from "@/lib/accounts/api";

function requireCapabilities(
	account: Account | null,
): AccountCapabilities | null {
	if (!account?.capabilities) {
		return null;
	}
	const caps = account.capabilities;
	if (
		typeof caps.accessManagementPage !== "boolean" ||
		typeof caps.editOwnProfile !== "boolean"
	) {
		return null;
	}
	return caps;
}

function targetRoleAllowed(
	caps: AccountCapabilities,
	field:
		| "manageableTargetRoles"
		| "suspendableTargetRoles"
		| "removableTargetRoles",
	target: AccountSummary,
): boolean {
	if (target.isIntendant || !target.role) {
		return false;
	}
	return caps[field].includes(target.role as AccountRole);
}

export function canAccessManagementPage(account: Account | null): boolean {
	return requireCapabilities(account)?.accessManagementPage ?? false;
}

export function canAccessOrganizationTab(account: Account | null): boolean {
	return requireCapabilities(account)?.accessOrganizationTab ?? false;
}

export function canAccessAccountsTab(account: Account | null): boolean {
	return requireCapabilities(account)?.accessAccountsTab ?? false;
}

export function inviteableRoles(account: Account | null): AccountRole[] {
	return (requireCapabilities(account)?.inviteableRoles as AccountRole[] | undefined) ?? [];
}

export function canEditLocalPartPolicy(account: Account | null): boolean {
	return requireCapabilities(account)?.editLocalPartPolicy ?? false;
}

export function canRemoveTarget(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	if (!actor || target.isIntendant || actor.id === target.id) {
		return false;
	}
	const caps = requireCapabilities(actor);
	if (!caps) {
		return false;
	}
	return targetRoleAllowed(caps, "removableTargetRoles", target);
}

export function canSuspendTarget(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	if (!actor || target.isIntendant || actor.id === target.id) {
		return false;
	}
	const caps = requireCapabilities(actor);
	if (!caps) {
		return false;
	}
	return targetRoleAllowed(caps, "suspendableTargetRoles", target);
}

export function canAssignRoles(actor: Account | null): boolean {
	return requireCapabilities(actor)?.assignRoles ?? false;
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
	return requireCapabilities(account)?.editOwnProfile ?? false;
}

export function canRegisterDomains(account: Account | null): boolean {
	return requireCapabilities(account)?.registerDomains ?? false;
}

export function canManageOidcClients(account: Account | null): boolean {
	return requireCapabilities(account)?.accessOidcClientsTab ?? false;
}

export function canAccessLogsTab(account: Account | null): boolean {
	return requireCapabilities(account)?.accessLogsTab ?? false;
}

export function canAccessDomainsTab(account: Account | null): boolean {
	return requireCapabilities(account)?.accessDomainsTab ?? false;
}

export function canManageMailboxes(account: Account | null): boolean {
	return requireCapabilities(account)?.manageMailboxes ?? false;
}

export function canAccessMailboxesTab(account: Account | null): boolean {
	return requireCapabilities(account)?.accessMailboxesTab ?? false;
}

export function showsManagerMailboxGrantsTab(account: Account | null): boolean {
	return requireCapabilities(account)?.showsManagerMailboxGrantsTab ?? false;
}

export function canAccessTemplatesTab(account: Account | null): boolean {
	const caps = requireCapabilities(account);
	if (!caps) {
		return false;
	}
	if (typeof caps.accessTemplatesTab === "boolean") {
		return caps.accessTemplatesTab;
	}
	return caps.accessAccountsTab;
}

export function canCreateGlobalTemplates(account: Account | null): boolean {
	const caps = requireCapabilities(account);
	if (!caps) {
		return false;
	}
	if (typeof caps.canCreateGlobalTemplates === "boolean") {
		return caps.canCreateGlobalTemplates;
	}
	return false;
}

export function canManageMailboxGrants(account: Account | null): boolean {
	return canManageSharedMailboxUsers(account);
}

export function canManageSharedMailboxUsers(account: Account | null): boolean {
	return requireCapabilities(account)?.manageSharedMailboxUsers ?? false;
}

export function canManageUserMailboxGrants(account: Account | null): boolean {
	return requireCapabilities(account)?.manageUserMailboxGrants ?? false;
}

export function canLockProfileFields(actor: Account | null): boolean {
	return requireCapabilities(actor)?.lockProfileFields ?? false;
}

export function canManageAssignments(actor: Account | null): boolean {
	return requireCapabilities(actor)?.manageAssignments ?? false;
}

export function canManageManagerMailboxAssignments(
	account: Account | null,
): boolean {
	return requireCapabilities(account)?.manageManagerMailboxAssignments ?? false;
}

export function canManageTarget(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	if (!actor || target.isIntendant || actor.id === target.id) {
		return false;
	}
	const caps = requireCapabilities(actor);
	if (!caps) {
		return false;
	}
	return targetRoleAllowed(caps, "manageableTargetRoles", target);
}

export function canManageTargetSecurity(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	return canManageTarget(actor, target);
}
