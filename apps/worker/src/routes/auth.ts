import type { RouteDefinition } from "../lib/http/router";
import {
	handleActivateInvite,
	handleBootstrapAuth,
	handleGetMe,
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
	handleInviteAccount,
	handleListAccounts,
	handleRemoveAccount,
	handleSuggestInviteLocalPart,
	handleSuspendAccount,
	handleUnsuspendAccount,
	handleUpdateAccount,
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
	{ method: "POST", path: `${prefix}/auth/bootstrap`, auth: false, handler: handleBootstrapAuth },
	{ method: "POST", path: `${prefix}/auth/sign-in`, auth: false, handler: handleSignIn },
	{ method: "POST", path: `${prefix}/auth/sign-out`, auth: false, handler: handleSignOut },
	{ method: "POST", path: `${prefix}/auth/activate`, auth: false, handler: handleActivateInvite },
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
