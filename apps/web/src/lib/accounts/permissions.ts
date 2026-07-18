import type { Account, AccountCapabilities } from "@/lib/auth/types";
import type { AccountRole, AccountSummary } from "@/lib/accounts/api";
import type { InstanceSettings } from "@/lib/accounts/instance-settings";

function deriveCapabilities(account: Account): AccountCapabilities {
	const accessAccountsTab =
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin" ||
		account.role === "manager";
	const accessDomainsTab =
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin";
	const assignRoles =
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin";

	let inviteableRoles: AccountRole[] = ["user"];
	if (account.isIntendant) {
		inviteableRoles = ["user", "manager", "admin", "superadmin"];
	} else if (account.role === "superadmin") {
		inviteableRoles = ["user", "manager", "admin"];
	} else if (account.role === "admin") {
		inviteableRoles = ["user", "manager"];
	}

	return {
		accessManagementPage: accessAccountsTab,
		accessAccountsTab,
		accessOrganizationTab: account.isIntendant,
		accessDomainsTab,
		accessMailboxesTab: accessDomainsTab || account.role === "manager",
		manageMailboxes: accessDomainsTab,
		registerDomains: account.isIntendant || account.role === "superadmin",
		assignRoles,
		editOwnProfile: !account.isIntendant,
		editLocalPartPolicy:
			account.isIntendant ||
			account.role === "superadmin" ||
			account.role === "admin",
		manageSharedMailboxUsers: accessAccountsTab,
		manageUserMailboxGrants: accessAccountsTab,
		lockProfileFields: accessAccountsTab,
		manageAssignments: assignRoles,
		manageManagerMailboxAssignments: assignRoles,
		showsManagerMailboxGrantsTab: account.role === "manager",
		accessTemplatesTab: accessAccountsTab,
		canCreateGlobalTemplates:
			account.isIntendant ||
			account.role === "superadmin" ||
			account.role === "admin",
		inviteableRoles,
	};
}

function hasServerCapabilities(
	capabilities: AccountCapabilities | undefined,
): capabilities is AccountCapabilities {
	return (
		capabilities !== undefined &&
		typeof capabilities.accessManagementPage === "boolean" &&
		typeof capabilities.editOwnProfile === "boolean"
	);
}

function effectiveCapabilities(account: Account | null): AccountCapabilities | null {
	if (!account) {
		return null;
	}
	if (hasServerCapabilities(account.capabilities)) {
		return account.capabilities;
	}
	return deriveCapabilities(account);
}

export function canAccessManagementPage(account: Account | null): boolean {
	return effectiveCapabilities(account)?.accessManagementPage ?? false;
}

export function canAccessOrganizationTab(
	account: Account | null,
	settings?: Pick<InstanceSettings, "organizationTabAccess">,
): boolean {
	if (!account) {
		return false;
	}
	if (hasServerCapabilities(account.capabilities)) {
		return account.capabilities.accessOrganizationTab;
	}
	if (account.isIntendant) {
		return true;
	}
	return (
		settings?.organizationTabAccess === "intendant_and_superadmins" &&
		account.role === "superadmin"
	);
}

export function canAccessAccountsTab(account: Account | null): boolean {
	return effectiveCapabilities(account)?.accessAccountsTab ?? false;
}

export function inviteableRoles(account: Account | null): AccountRole[] {
	return (effectiveCapabilities(account)?.inviteableRoles as AccountRole[] | undefined) ?? [];
}

export function canEditLocalPartPolicy(account: Account | null): boolean {
	return effectiveCapabilities(account)?.editLocalPartPolicy ?? false;
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
	return effectiveCapabilities(actor)?.assignRoles ?? false;
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
	return effectiveCapabilities(account)?.editOwnProfile ?? false;
}

export function canRegisterDomains(account: Account | null): boolean {
	return effectiveCapabilities(account)?.registerDomains ?? false;
}

export function canManageOidcClients(account: Account | null): boolean {
	if (!account) {
		return false;
	}
	return account.isIntendant || account.role === "superadmin";
}

export function canAccessLogsTab(account: Account | null): boolean {
	if (!account) {
		return false;
	}
	return account.isIntendant || account.role === "superadmin";
}

export function canAccessDomainsTab(account: Account | null): boolean {
	return effectiveCapabilities(account)?.accessDomainsTab ?? false;
}

export function canManageMailboxes(account: Account | null): boolean {
	return effectiveCapabilities(account)?.manageMailboxes ?? false;
}

export function canAccessMailboxesTab(account: Account | null): boolean {
	return effectiveCapabilities(account)?.accessMailboxesTab ?? false;
}

export function showsManagerMailboxGrantsTab(account: Account | null): boolean {
	return effectiveCapabilities(account)?.showsManagerMailboxGrantsTab ?? false;
}

export function canAccessTemplatesTab(account: Account | null): boolean {
	const caps = effectiveCapabilities(account);
	if (!caps) {
		return false;
	}
	if (typeof caps.accessTemplatesTab === "boolean") {
		return caps.accessTemplatesTab;
	}
	return caps.accessAccountsTab;
}

export function canCreateGlobalTemplates(account: Account | null): boolean {
	const caps = effectiveCapabilities(account);
	if (!caps) {
		return false;
	}
	if (typeof caps.canCreateGlobalTemplates === "boolean") {
		return caps.canCreateGlobalTemplates;
	}
	if (!account) {
		return false;
	}
	return (
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin"
	);
}

export function canManageMailboxGrants(account: Account | null): boolean {
	return canManageSharedMailboxUsers(account);
}

export function canManageSharedMailboxUsers(account: Account | null): boolean {
	return effectiveCapabilities(account)?.manageSharedMailboxUsers ?? false;
}

export function canManageUserMailboxGrants(account: Account | null): boolean {
	return effectiveCapabilities(account)?.manageUserMailboxGrants ?? false;
}

export function canLockProfileFields(actor: Account | null): boolean {
	return effectiveCapabilities(actor)?.lockProfileFields ?? false;
}

export function canManageAssignments(actor: Account | null): boolean {
	return effectiveCapabilities(actor)?.manageAssignments ?? false;
}

export function canManageManagerMailboxAssignments(
	account: Account | null,
): boolean {
	return effectiveCapabilities(account)?.manageManagerMailboxAssignments ?? false;
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

export function canManageTargetSecurity(
	actor: Account | null,
	target: AccountSummary,
): boolean {
	return canManageTarget(actor, target);
}
