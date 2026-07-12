import type { RouteDefinition } from "../lib/http/router";
import {
	handleActivateInvite,
	handleForgotPassword,
	handleGetMe,
	handlePreviewInvite,
	handleRegenerateIntendantPassword,
	handleResetPassword,
	handleSignIn,
	handleSignOut,
	handleUpdateMe,
} from "../controllers/auth";
import {
	handleConfirmMfa,
	handleDisableMfa,
	handleGetMfaStatus,
	handleSendMfaDisableRecoveryCode,
	handleSetupMfa,
	handleVerifyMfaSignIn,
} from "../controllers/mfa";
import {
	handleSendRecoveryEmailCode,
	handleVerifyRecoveryEmail,
} from "../controllers/recovery-email";
import {
	handleListSessions,
	handleRevokeAllSessions,
	handleRevokeSession,
} from "../controllers/sessions";
import {
	handleAssignRole,
	handleCreatePasswordResetCode,
	handleDisableAccountMfa,
	handleGetAccount,
	handleGetAccountMfaStatus,
	handleGetDomainLocalPartPolicy,
	handleGrantSharedMailboxAccess,
	handleGrantManagerMailboxAssignment,
	handleInviteAccount,
	handleListAccounts,
	handleListAccountSessions,
	handleListMailboxGrantHolders,
	handleListMailboxManagerAssignments,
	handleRegenerateInviteCode,
	handleRemoveAccount,
	handleRevokeAccountSession,
	handleRevokeAllAccountSessions,
	handleRevokeSharedMailboxAccess,
	handleRevokeManagerMailboxAssignment,
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
import {
	handleGetInstanceSettings,
	handleUpdateInstanceSettings,
} from "../controllers/instance-settings";

const prefix = "/api/v1";

export const authRoutes: RouteDefinition[] = [
	{ method: "POST", path: `${prefix}/auth/sign-in`, auth: false, handler: handleSignIn },
	{ method: "POST", path: `${prefix}/auth/sign-out`, auth: false, handler: handleSignOut },
	{
		method: "POST",
		path: `${prefix}/auth/mfa/verify`,
		auth: false,
		handler: handleVerifyMfaSignIn,
	},
	{ method: "GET", path: `${prefix}/auth/mfa`, handler: handleGetMfaStatus },
	{ method: "POST", path: `${prefix}/auth/mfa/setup`, handler: handleSetupMfa },
	{ method: "POST", path: `${prefix}/auth/mfa/confirm`, handler: handleConfirmMfa },
	{
		method: "POST",
		path: `${prefix}/auth/mfa/disable/send-recovery-code`,
		handler: handleSendMfaDisableRecoveryCode,
	},
	{ method: "DELETE", path: `${prefix}/auth/mfa`, handler: handleDisableMfa },
	{ method: "POST", path: `${prefix}/auth/activate`, auth: false, handler: handleActivateInvite },
	{
		method: "GET",
		path: `${prefix}/auth/invite-preview`,
		auth: false,
		handler: handlePreviewInvite,
	},
	{
		method: "POST",
		path: `${prefix}/auth/forgot-password`,
		auth: false,
		handler: handleForgotPassword,
	},
	{ method: "POST", path: `${prefix}/auth/reset-password`, auth: false, handler: handleResetPassword },
	{ method: "GET", path: `${prefix}/auth/me`, handler: handleGetMe },
	{ method: "PATCH", path: `${prefix}/auth/me`, handler: handleUpdateMe },
	{
		method: "POST",
		path: `${prefix}/auth/recovery-email/send`,
		handler: handleSendRecoveryEmailCode,
	},
	{
		method: "POST",
		path: `${prefix}/auth/recovery-email/verify`,
		handler: handleVerifyRecoveryEmail,
	},
	{ method: "GET", path: `${prefix}/auth/sessions`, handler: handleListSessions },
	{
		method: "DELETE",
		path: `${prefix}/auth/sessions/:id`,
		handler: handleRevokeSession,
	},
	{
		method: "DELETE",
		path: `${prefix}/auth/sessions`,
		handler: handleRevokeAllSessions,
	},
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
		method: "GET",
		path: `${prefix}/accounts/:id/sessions`,
		handler: handleListAccountSessions,
	},
	{
		method: "DELETE",
		path: `${prefix}/accounts/:id/sessions/:sessionId`,
		handler: handleRevokeAccountSession,
	},
	{
		method: "DELETE",
		path: `${prefix}/accounts/:id/sessions`,
		handler: handleRevokeAllAccountSessions,
	},
	{
		method: "GET",
		path: `${prefix}/accounts/:id/mfa`,
		handler: handleGetAccountMfaStatus,
	},
	{
		method: "DELETE",
		path: `${prefix}/accounts/:id/mfa`,
		handler: handleDisableAccountMfa,
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
		method: "POST",
		path: `${prefix}/accounts/:id/manager-assignments`,
		handler: handleGrantManagerMailboxAssignment,
	},
	{
		method: "DELETE",
		path: `${prefix}/accounts/:id/manager-assignments/:mailboxId`,
		handler: handleRevokeManagerMailboxAssignment,
	},
	{
		method: "GET",
		path: `${prefix}/mailboxes/:mailboxId/grants`,
		handler: handleListMailboxGrantHolders,
	},
	{
		method: "GET",
		path: `${prefix}/mailboxes/:mailboxId/manager-assignments`,
		handler: handleListMailboxManagerAssignments,
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
		path: `${prefix}/instance/settings`,
		handler: handleGetInstanceSettings,
	},
	{
		method: "PATCH",
		path: `${prefix}/instance/settings`,
		handler: handleUpdateInstanceSettings,
	},

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
