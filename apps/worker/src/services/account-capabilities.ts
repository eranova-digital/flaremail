import type { AccountRole } from "../lib/auth/types";
import {
	canAccessOrganizationSettings,
	type InstanceSettings,
} from "./instance-settings";

export type AccountCapabilities = {
	accessManagementPage: boolean;
	accessAccountsTab: boolean;
	accessOrganizationTab: boolean;
	accessDomainsTab: boolean;
	accessMailboxesTab: boolean;
	manageMailboxes: boolean;
	registerDomains: boolean;
	assignRoles: boolean;
	editOwnProfile: boolean;
	editLocalPartPolicy: boolean;
	manageSharedMailboxUsers: boolean;
	manageUserMailboxGrants: boolean;
	lockProfileFields: boolean;
	manageAssignments: boolean;
	manageManagerMailboxAssignments: boolean;
	showsManagerMailboxGrantsTab: boolean;
	accessTemplatesTab: boolean;
	canCreateGlobalTemplates: boolean;
	accessOidcClientsTab: boolean;
	accessLogsTab: boolean;
	manageableTargetRoles: AccountRole[];
	suspendableTargetRoles: AccountRole[];
	removableTargetRoles: AccountRole[];
	inviteableRoles: AccountRole[];
};

function inviteableRoles(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): AccountRole[] {
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

function manageableTargetRoles(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): AccountRole[] {
	if (account.isIntendant || account.role === "superadmin") {
		return ["user", "manager", "admin", "superadmin"];
	}
	if (account.role === "admin") {
		return ["user", "manager"];
	}
	if (account.role === "manager") {
		return ["user"];
	}
	return [];
}

function suspendableTargetRoles(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): AccountRole[] {
	return manageableTargetRoles(account);
}

function removableTargetRoles(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): AccountRole[] {
	if (account.isIntendant || account.role === "superadmin") {
		return ["user", "manager", "admin", "superadmin"];
	}
	if (account.role === "admin") {
		return ["user", "manager"];
	}
	return [];
}

function canAssignRoles(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): boolean {
	return (
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin"
	);
}

function canAccessAccountsTab(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): boolean {
	return (
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin" ||
		account.role === "manager"
	);
}

function canAccessDomainsTab(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): boolean {
	return (
		account.isIntendant ||
		account.role === "superadmin" ||
		account.role === "admin"
	);
}

function canAccessOidcClientsTab(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): boolean {
	return account.isIntendant || account.role === "superadmin";
}

function canAccessLogsTab(account: {
	isIntendant: boolean;
	role: AccountRole | null;
}): boolean {
	return account.isIntendant || account.role === "superadmin";
}

export function computeAccountCapabilities(
	account: {
		isIntendant: boolean;
		role: AccountRole | null;
	},
	settings: InstanceSettings,
): AccountCapabilities {
	const accessAccountsTab = canAccessAccountsTab(account);
	const accessDomainsTab = canAccessDomainsTab(account);
	const assignRoles = canAssignRoles(account);

	return {
		accessManagementPage: accessAccountsTab,
		accessAccountsTab,
		accessOrganizationTab: canAccessOrganizationSettings(account, settings),
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
		accessOidcClientsTab: canAccessOidcClientsTab(account),
		accessLogsTab: canAccessLogsTab(account),
		manageableTargetRoles: manageableTargetRoles(account),
		suspendableTargetRoles: suspendableTargetRoles(account),
		removableTargetRoles: removableTargetRoles(account),
		inviteableRoles: inviteableRoles(account),
	};
}
