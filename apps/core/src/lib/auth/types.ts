export type AccountRole = "user" | "manager" | "admin" | "superadmin";
export type AccountStatus = "pending" | "active" | "suspended";

export type PrincipalKind = "session" | "api_key" | "oidc_user" | "oidc_client" | "legacy";

export type Principal = {
	kind: PrincipalKind;
	accountId: string | null;
	isIntendant: boolean;
	role: AccountRole | null;
	status: AccountStatus | null;
	loginIdentifier: string | null;
	primaryMailboxId: string | null;
	domainIds: string[];
	grantMailboxIds: string[];
	sharedMailboxAssignment: {
		domainId: string;
		mailboxId: string | null;
		allSharedMailboxes: boolean;
	}[];
	apiKeyId?: string;
	apiKeyScopes?: string[];
	oidcClientId?: string;
	oidcScopes?: string[];
	m2mPermissions?: string[];
	sessionId?: string;
};

export type RoutePermission =
	| "public"
	| "authenticated"
	| "platform"
	| "mail_read"
	| "mail_write"
	| "domain_admin"
	| "domain_manage_users";
