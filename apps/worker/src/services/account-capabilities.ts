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
		inviteableRoles: inviteableRoles(account),
	};
}
