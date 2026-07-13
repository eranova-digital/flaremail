import type { ProfilePicture } from "@/lib/profile-picture";

export type AccountProfile = {
	firstName: string | null;
	lastName: string | null;
	recoveryAddress: string | null;
	phone: string | null;
	address: {
		country: string | null;
		state: string | null;
		city: string | null;
		line1: string | null;
		line2: string | null;
	};
};

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
	inviteableRoles: string[];
};

export type Account = {
	id: string;
	isIntendant: boolean;
	role: string | null;
	status: string;
	loginIdentifier: string;
	primaryMailboxId: string | null;
	domainIds?: string[];
	profile: AccountProfile | null;
	lockedFields?: string[];
	displayName?: string;
	profilePicture?: ProfilePicture | null;
	mfaEnabled?: boolean;
	mfaEnabledAt?: string | null;
	securityRequirements?: {
		recoveryEmail: boolean;
		mfa: boolean;
	};
	organizationPolicies?: {
		mfaRequired: boolean;
		recoveryEmailRequired: boolean;
	};
	capabilities?: AccountCapabilities;
};

export type SignInResult =
	| { ok: true }
	| { requiresMfa: true; mfaToken: string };

export type MfaSetup = {
	secret: string;
	otpauthUrl: string;
};

export type MfaStatus = {
	enabled: boolean;
	enabledAt: string | null;
};

export type AuthSession = {
	id: string;
	current: boolean;
	createdAt: string;
	lastSeenAt: string;
	expiresAt: string;
	ipAddress: string | null;
	countryCode: string | null;
	browser: string | null;
	os: string | null;
};

export type PasskeySummary = {
	id: string;
	name: string | null;
	createdAt: string;
	lastUsedAt: string | null;
	backedUp: boolean;
};
