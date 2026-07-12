import type { RoutePermission } from "./types";

export type AuthAction = RoutePermission;

export type AccountOperation =
	| "view"
	| "manage"
	| "manage_security"
	| "remove"
	| "assign_invite_role";

export type MailboxOperation = "read" | "manage" | "send";

export type AuthResource = {
	domainId?: string;
	mailboxId?: string;
	accountId?: string;
	messageId?: string;
	draftId?: string;
};

export class AuthorizationDeniedError extends Error {
	constructor(message = "You do not have permission to perform this action") {
		super(message);
		this.name = "AuthorizationDeniedError";
	}
}

/** @deprecated Route actions are declared on RouteDefinition.action. */
export function actionForPath(method: string, path: string): AuthAction {
	if (path.startsWith("/api/v1/auth/")) {
		if (path === "/api/v1/auth/me") {
			return "authenticated";
		}
		return "public";
	}
	if (path.startsWith("/api/v1/oauth/") || path === "/.well-known/openid-configuration") {
		if (path === "/api/v1/oauth/authorize" || path === "/api/v1/oauth/userinfo") {
			return "authenticated";
		}
		return "public";
	}

	if (method === "GET" && path === "/api/v1/domains") {
		return "authenticated";
	}
	if (method === "POST" && path === "/api/v1/domains") {
		return "platform";
	}
	if (path.startsWith("/api/v1/domains/")) {
		if (path.endsWith("/local-part-policy") && method === "GET") {
			return "domain_manage_users";
		}
		return "domain_admin";
	}
	if (method === "GET" && path === "/api/v1/mailboxes") {
		return "authenticated";
	}
	if (method === "POST" && path === "/api/v1/mailboxes") {
		return "domain_admin";
	}
	if (path.startsWith("/api/v1/mailboxes/")) {
		if (
			(path.endsWith("/grants") || path.endsWith("/manager-assignments")) &&
			method === "GET"
		) {
			return "domain_manage_users";
		}
		if (method === "GET") {
			return "mail_read";
		}
		return "domain_admin";
	}
	if (path.startsWith("/api/v1/messages/")) {
		if (method === "GET") {
			return "mail_read";
		}
		return "mail_write";
	}
	if (path.startsWith("/api/v1/threads")) {
		if (method === "GET") {
			return "mail_read";
		}
		return "mail_write";
	}
	if (path === "/api/v1/search") {
		return "mail_read";
	}
	if (path.startsWith("/api/v1/attachments/")) {
		return "mail_read";
	}
	if (path.startsWith("/api/v1/accounts")) {
		return "domain_manage_users";
	}
	if (path.startsWith("/api/v1/api-keys")) {
		return "authenticated";
	}
	if (path.startsWith("/api/v1/oidc-clients")) {
		return "platform";
	}

	return "authenticated";
}
