import { AuthorizationDeniedError } from "./actions";
import { authorize } from "./access";
import type { AuthAction } from "./actions";
import type { Principal } from "./types";

export const API_KEY_SCOPES = [
	"domains:list",
	"domains:create",
	"domains:read",
	"domains:update",
	"domains:delete",
	"domain_validation_runs:list",
	"domain_validation_runs:create",
	"domain_validation_runs:read",
	"domain_local_part_policies:read",
	"domain_local_part_policies:update",
	"mailboxes:list",
	"mailboxes:create",
	"mailboxes:read",
	"mailboxes:update",
	"mailboxes:delete",
	"mailbox_grants:list",
	"mailbox_manager_assignments:list",
	"labels:list",
	"labels:create",
	"labels:read",
	"labels:update",
	"labels:delete",
	"messages:send",
	"drafts:create",
	"drafts:update",
	"drafts:delete",
	"drafts:send",
	"messages:reply",
	"messages:forward",
	"messages:read_preview",
	"messages:read_raw",
	"messages:read",
	"messages:read_images",
	"threads:list",
	"threads:read",
	"threads:update",
	"search:read",
	"attachments:read",
	"accounts:list",
	"accounts:read",
	"accounts:update",
	"account_assignments:update",
	"accounts:invite",
	"accounts:suggest_local_part",
	"accounts:assign_role",
	"accounts:suspend",
	"accounts:unsuspend",
	"accounts:delete",
	"account_password_reset_codes:create",
	"account_invites:regenerate",
	"account_mailbox_grants:create",
	"account_mailbox_grants:delete",
	"account_manager_assignments:create",
	"account_manager_assignments:delete",
	"account_profile_pictures:read",
	"account_profile_pictures:update",
	"account_profile_pictures:delete",
	"profile:read",
	"profile:update",
	"profile_picture:read",
	"profile_picture:update",
	"profile_picture:delete",
	"oidc_clients:create",
	"instance_settings:read",
	"instance_settings:update",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const API_KEY_SCOPE_SET = new Set<string>(API_KEY_SCOPES);

/** Maps each scope to the coarse AuthAction used for grantability checks. */
export const SCOPE_ACTION_REQUIREMENTS: Record<ApiKeyScope, AuthAction> = {
	"domains:list": "authenticated",
	"domains:create": "platform",
	"domains:read": "domain_admin",
	"domains:update": "domain_admin",
	"domains:delete": "domain_admin",
	"domain_validation_runs:list": "domain_admin",
	"domain_validation_runs:create": "domain_admin",
	"domain_validation_runs:read": "domain_admin",
	"domain_local_part_policies:read": "domain_manage_users",
	"domain_local_part_policies:update": "domain_admin",
	"mailboxes:list": "authenticated",
	"mailboxes:create": "domain_admin",
	"mailboxes:read": "mail_read",
	"mailboxes:update": "domain_admin",
	"mailboxes:delete": "domain_admin",
	"mailbox_grants:list": "domain_manage_users",
	"mailbox_manager_assignments:list": "domain_manage_users",
	"labels:list": "mail_read",
	"labels:create": "domain_admin",
	"labels:read": "mail_read",
	"labels:update": "domain_admin",
	"labels:delete": "domain_admin",
	"messages:send": "mail_write",
	"drafts:create": "mail_write",
	"drafts:update": "mail_write",
	"drafts:delete": "mail_write",
	"drafts:send": "mail_write",
	"messages:reply": "mail_write",
	"messages:forward": "mail_write",
	"messages:read_preview": "mail_read",
	"messages:read_raw": "mail_read",
	"messages:read": "mail_read",
	"messages:read_images": "mail_read",
	"threads:list": "mail_read",
	"threads:read": "mail_read",
	"threads:update": "mail_write",
	"search:read": "mail_read",
	"attachments:read": "mail_read",
	"accounts:list": "domain_manage_users",
	"accounts:read": "domain_manage_users",
	"accounts:update": "domain_manage_users",
	"account_assignments:update": "domain_manage_users",
	"accounts:invite": "domain_manage_users",
	"accounts:suggest_local_part": "domain_manage_users",
	"accounts:assign_role": "domain_manage_users",
	"accounts:suspend": "domain_manage_users",
	"accounts:unsuspend": "domain_manage_users",
	"accounts:delete": "domain_manage_users",
	"account_password_reset_codes:create": "domain_manage_users",
	"account_invites:regenerate": "domain_manage_users",
	"account_mailbox_grants:create": "domain_manage_users",
	"account_mailbox_grants:delete": "domain_manage_users",
	"account_manager_assignments:create": "domain_manage_users",
	"account_manager_assignments:delete": "domain_manage_users",
	"account_profile_pictures:read": "authenticated",
	"account_profile_pictures:update": "domain_manage_users",
	"account_profile_pictures:delete": "domain_manage_users",
	"profile:read": "authenticated",
	"profile:update": "authenticated",
	"profile_picture:read": "authenticated",
	"profile_picture:update": "authenticated",
	"profile_picture:delete": "authenticated",
	"oidc_clients:create": "platform",
	"instance_settings:read": "platform",
	"instance_settings:update": "platform",
};

export function isApiKeyScope(value: string): value is ApiKeyScope {
	return API_KEY_SCOPE_SET.has(value);
}

export function normalizeApiKeyScopes(input: Iterable<string>): ApiKeyScope[] {
	const normalized = new Set<ApiKeyScope>();
	for (const value of input) {
		const scope = value.trim();
		if (!isApiKeyScope(scope)) {
			throw new Error(`Unknown API key scope '${value}'`);
		}
		normalized.add(scope);
	}
	return [...normalized].sort();
}

/** Reads scopes persisted on a key, ignoring values removed from the catalog. */
export function parseStoredApiKeyScopes(input: Iterable<string>): ApiKeyScope[] {
	const normalized = new Set<ApiKeyScope>();
	for (const value of input) {
		const scope = value.trim();
		if (isApiKeyScope(scope)) {
			normalized.add(scope);
		}
	}
	return [...normalized].sort();
}

export function canPrincipalGrantApiKeyScope(
	principal: Principal,
	scope: ApiKeyScope,
): boolean {
	if (principal.kind === "api_key") {
		return false;
	}
	try {
		authorize(principal, SCOPE_ACTION_REQUIREMENTS[scope]);
		return true;
	} catch (error) {
		if (error instanceof AuthorizationDeniedError) {
			return false;
		}
		throw error;
	}
}

export function listGrantableApiKeyScopes(principal: Principal): ApiKeyScope[] {
	return API_KEY_SCOPES.filter((scope) =>
		canPrincipalGrantApiKeyScope(principal, scope),
	);
}
