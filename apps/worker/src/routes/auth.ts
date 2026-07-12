import type { RouteDefinition } from "../lib/http/router";
import {
	handleActivateInvite,
	handleGetMe,
	handlePreviewInvite,
	handleRegenerateIntendantPassword,
	handleResetPassword,
	handleSignIn,
	handleSignOut,
	handleUpdateMe,
} from "../controllers/auth";
import {
	handleAssignRole,
	handleCreatePasswordResetCode,
	handleGetAccount,
	handleGetDomainLocalPartPolicy,
	handleGrantSharedMailboxAccess,
	handleInviteAccount,
	handleListAccounts,
	handleListMailboxGrantHolders,
	handleRegenerateInviteCode,
	handleRemoveAccount,
	handleRevokeSharedMailboxAccess,
	handleSuggestInviteLocalPart,
	handleSuspendAccount,
	handleUnsuspendAccount,
	handleUpdateAccount,
	handleUpdateAccountAssignments,
	handleUpdateDomainLocalPartPolicy,
} from "../controllers/accounts";
import {
	handleCreateApiKey,
	handleListApiKeys,
	handleRevokeApiKey,
} from "../controllers/api-keys";
import {
	handleCreateOidcClient,
	handleOidcAuthorize,
	handleOidcToken,
	handleOidcUserinfo,
	handleOpenIdDiscovery,
	handleOidcJwks,
} from "../controllers/oidc";

const prefix = "/api/v1";

export const authRoutes: RouteDefinition[] = [
	{ method: "POST", path: `${prefix}/auth/sign-in`, auth: false, handler: handleSignIn },
	{ method: "POST", path: `${prefix}/auth/sign-out`, auth: false, handler: handleSignOut },
	{ method: "POST", path: `${prefix}/auth/activate`, auth: false, handler: handleActivateInvite },
	{
		method: "GET",
		path: `${prefix}/auth/invite-preview`,
		auth: false,
		handler: handlePreviewInvite,
	},
	{ method: "POST", path: `${prefix}/auth/reset-password`, auth: false, handler: handleResetPassword },
	{ method: "GET", path: `${prefix}/auth/me`, handler: handleGetMe },
	{ method: "PATCH", path: `${prefix}/auth/me`, handler: handleUpdateMe },
	{
		method: "POST",
		path: `${prefix}/auth/intendant/regenerate-password`,
		handler: handleRegenerateIntendantPassword,
	},

	{ method: "GET", path: `${prefix}/accounts`, handler: handleListAccounts },
	{ method: "GET", path: `${prefix}/accounts/:id`, handler: handleGetAccount },
	{ method: "PATCH", path: `${prefix}/accounts/:id`, handler: handleUpdateAccount },
	{
		method: "PATCH",
		path: `${prefix}/accounts/:id/assignments`,
		handler: handleUpdateAccountAssignments,
	},
	{ method: "POST", path: `${prefix}/accounts/invite`, handler: handleInviteAccount },
	{
		method: "POST",
		path: `${prefix}/accounts/invite/suggest-local-part`,
		handler: handleSuggestInviteLocalPart,
	},
	{ method: "POST", path: `${prefix}/accounts/assign-role`, handler: handleAssignRole },
	{ method: "POST", path: `${prefix}/accounts/:id/suspend`, handler: handleSuspendAccount },
	{ method: "POST", path: `${prefix}/accounts/:id/unsuspend`, handler: handleUnsuspendAccount },
	{ method: "DELETE", path: `${prefix}/accounts/:id`, handler: handleRemoveAccount },
	{
		method: "POST",
		path: `${prefix}/accounts/:id/password-reset-code`,
		handler: handleCreatePasswordResetCode,
	},
	{
		method: "POST",
		path: `${prefix}/accounts/:id/regenerate-invite`,
		handler: handleRegenerateInviteCode,
	},
	{
		method: "POST",
		path: `${prefix}/accounts/:id/mailbox-grants`,
		handler: handleGrantSharedMailboxAccess,
	},
	{
		method: "DELETE",
		path: `${prefix}/accounts/:id/mailbox-grants/:mailboxId`,
		handler: handleRevokeSharedMailboxAccess,
	},
	{
		method: "GET",
		path: `${prefix}/mailboxes/:mailboxId/grants`,
		handler: handleListMailboxGrantHolders,
	},
	{
		method: "GET",
		path: `${prefix}/domains/:domainId/local-part-policy`,
		handler: handleGetDomainLocalPartPolicy,
	},
	{
		method: "PATCH",
		path: `${prefix}/domains/:domainId/local-part-policy`,
		handler: handleUpdateDomainLocalPartPolicy,
	},

	{ method: "GET", path: `${prefix}/api-keys`, handler: handleListApiKeys },
	{ method: "POST", path: `${prefix}/api-keys`, handler: handleCreateApiKey },
	{ method: "DELETE", path: `${prefix}/api-keys/:id`, handler: handleRevokeApiKey },

	{ method: "POST", path: `${prefix}/oidc-clients`, handler: handleCreateOidcClient },

	{
		method: "GET",
		path: "/.well-known/openid-configuration",
		auth: false,
		handler: handleOpenIdDiscovery,
	},
	{ method: "GET", path: `${prefix}/oauth/jwks`, auth: false, handler: handleOidcJwks },
	{ method: "GET", path: `${prefix}/oauth/authorize`, handler: handleOidcAuthorize },
	{ method: "POST", path: `${prefix}/oauth/token`, auth: false, handler: handleOidcToken },
	{ method: "GET", path: `${prefix}/oauth/userinfo`, handler: handleOidcUserinfo },
];
