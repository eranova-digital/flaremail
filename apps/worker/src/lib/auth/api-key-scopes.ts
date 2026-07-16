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

const SCOPE_ACTION_REQUIREMENTS: Record<ApiKeyScope, AuthAction> = {
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

export type ApiKeyRouteContext = {
	principal?: Principal;
	params?: Record<string, string>;
};

export function apiKeyScopesForRoute(
	method: string,
	routePath: string,
	context: ApiKeyRouteContext = {},
): ApiKeyScope[] | null {
	if (
		method === "GET" &&
		routePath === "/api/v1/accounts/:id/profile-picture" &&
		context.principal?.accountId &&
		context.params?.id === context.principal.accountId
	) {
		return ["profile_picture:read"];
	}

	const requiredScope = scopeRequiredForRoute(method, routePath);
	return requiredScope ? [requiredScope] : null;
}

export function scopeRequiredForRoute(
	method: string,
	routePath: string,
): ApiKeyScope | null {
	switch (`${method} ${routePath}`) {
		case "GET /api/v1/domains":
			return "domains:list";
		case "POST /api/v1/domains":
			return "domains:create";
		case "GET /api/v1/domains/:id":
			return "domains:read";
		case "PATCH /api/v1/domains/:id":
			return "domains:update";
		case "DELETE /api/v1/domains/:id":
			return "domains:delete";
		case "GET /api/v1/domains/:id/validation-runs":
			return "domain_validation_runs:list";
		case "POST /api/v1/domains/:id/validation-runs":
			return "domain_validation_runs:create";
		case "GET /api/v1/domains/:id/validation-runs/:runId":
			return "domain_validation_runs:read";
		case "GET /api/v1/domains/:domainId/local-part-policy":
			return "domain_local_part_policies:read";
		case "PATCH /api/v1/domains/:domainId/local-part-policy":
			return "domain_local_part_policies:update";
		case "GET /api/v1/mailboxes":
			return "mailboxes:list";
		case "POST /api/v1/mailboxes":
			return "mailboxes:create";
		case "GET /api/v1/mailboxes/:id":
			return "mailboxes:read";
		case "PATCH /api/v1/mailboxes/:id":
			return "mailboxes:update";
		case "DELETE /api/v1/mailboxes/:id":
			return "mailboxes:delete";
		case "GET /api/v1/mailboxes/:mailboxId/grants":
			return "mailbox_grants:list";
		case "GET /api/v1/mailboxes/:mailboxId/manager-assignments":
			return "mailbox_manager_assignments:list";
		case "GET /api/v1/mailboxes/:mailboxId/labels":
			return "labels:list";
		case "POST /api/v1/mailboxes/:mailboxId/labels":
			return "labels:create";
		case "GET /api/v1/mailboxes/:mailboxId/labels/:id":
			return "labels:read";
		case "PATCH /api/v1/mailboxes/:mailboxId/labels/:id":
			return "labels:update";
		case "DELETE /api/v1/mailboxes/:mailboxId/labels/:id":
			return "labels:delete";
		case "POST /api/v1/messages/send":
			return "messages:send";
		case "POST /api/v1/messages/drafts":
			return "drafts:create";
		case "PATCH /api/v1/messages/drafts/:id":
			return "drafts:update";
		case "DELETE /api/v1/messages/drafts/:id":
			return "drafts:delete";
		case "POST /api/v1/messages/drafts/:id/send":
			return "drafts:send";
		case "POST /api/v1/messages/:id/reply":
			return "messages:reply";
		case "POST /api/v1/messages/:id/forward":
			return "messages:forward";
		case "GET /api/v1/messages/:id/preview":
			return "messages:read_preview";
		case "GET /api/v1/messages/:id/raw":
			return "messages:read_raw";
		case "GET /api/v1/messages/:id":
			return "messages:read";
		case "GET /api/v1/messages/:id/images/:imageId":
			return "messages:read_images";
		case "GET /api/v1/threads":
			return "threads:list";
		case "GET /api/v1/threads/:id/messages":
			return "threads:read";
		case "POST /api/v1/threads/:id/:action":
		case "PATCH /api/v1/threads/:id":
			return "threads:update";
		case "GET /api/v1/threads/:id":
			return "threads:read";
		case "POST /api/v1/search":
			return "search:read";
		case "GET /api/v1/attachments/:id":
			return "attachments:read";
		case "GET /api/v1/accounts":
			return "accounts:list";
		case "GET /api/v1/accounts/:id":
			return "accounts:read";
		case "PATCH /api/v1/accounts/:id":
			return "accounts:update";
		case "PATCH /api/v1/accounts/:id/assignments":
			return "account_assignments:update";
		case "POST /api/v1/accounts/invite":
			return "accounts:invite";
		case "POST /api/v1/accounts/invite/suggest-local-part":
			return "accounts:suggest_local_part";
		case "POST /api/v1/accounts/assign-role":
			return "accounts:assign_role";
		case "POST /api/v1/accounts/:id/suspend":
			return "accounts:suspend";
		case "POST /api/v1/accounts/:id/unsuspend":
			return "accounts:unsuspend";
		case "DELETE /api/v1/accounts/:id":
			return "accounts:delete";
		case "POST /api/v1/accounts/:id/password-reset-code":
			return "account_password_reset_codes:create";
		case "POST /api/v1/accounts/:id/regenerate-invite":
			return "account_invites:regenerate";
		case "POST /api/v1/accounts/:id/mailbox-grants":
			return "account_mailbox_grants:create";
		case "DELETE /api/v1/accounts/:id/mailbox-grants/:mailboxId":
			return "account_mailbox_grants:delete";
		case "POST /api/v1/accounts/:id/manager-assignments":
			return "account_manager_assignments:create";
		case "DELETE /api/v1/accounts/:id/manager-assignments/:mailboxId":
			return "account_manager_assignments:delete";
		case "GET /api/v1/accounts/:id/profile-picture":
			return "account_profile_pictures:read";
		case "PUT /api/v1/accounts/:id/profile-picture":
			return "account_profile_pictures:update";
		case "DELETE /api/v1/accounts/:id/profile-picture":
			return "account_profile_pictures:delete";
		case "GET /api/v1/auth/me":
			return "profile:read";
		case "PATCH /api/v1/auth/me":
			return "profile:update";
		case "PUT /api/v1/auth/me/profile-picture":
			return "profile_picture:update";
		case "DELETE /api/v1/auth/me/profile-picture":
			return "profile_picture:delete";
		case "POST /api/v1/oidc-clients":
			return "oidc_clients:create";
		case "GET /api/v1/instance/settings":
			return "instance_settings:read";
		case "PATCH /api/v1/instance/settings":
			return "instance_settings:update";
		default:
			return null;
	}
}

export function canPrincipalGrantApiKeyScope(
	principal: Principal,
	scope: ApiKeyScope,
): boolean {
	if (principal.kind === "api_key") {
		return false;
	}
	if (principal.status !== "active") {
		return false;
	}
	switch (SCOPE_ACTION_REQUIREMENTS[scope]) {
		case "authenticated":
		case "mail_read":
		case "mail_write":
			return Boolean(principal.isIntendant || principal.role);
		case "domain_manage_users":
			return (
				principal.isIntendant ||
				principal.role === "superadmin" ||
				principal.role === "admin" ||
				principal.role === "manager"
			);
		case "domain_admin":
			return (
				principal.isIntendant ||
				principal.role === "superadmin" ||
				principal.role === "admin"
			);
		case "platform":
			return principal.isIntendant || principal.role === "superadmin";
		case "public":
			return true;
	}
}

export function listGrantableApiKeyScopes(principal: Principal): ApiKeyScope[] {
	return API_KEY_SCOPES.filter((scope) =>
		canPrincipalGrantApiKeyScope(principal, scope),
	);
}
