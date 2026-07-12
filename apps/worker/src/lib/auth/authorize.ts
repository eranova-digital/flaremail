import { problemResponse, requestInstance } from "../http/problem";
import type { RoutePermission } from "./types";
import type { Principal } from "./types";
import {
	accessibleMailboxIds,
	hasDomainAccess,
	isPlatformPrincipal,
} from "./principal";

export function authorizePrincipal(
	request: Request,
	principal: Principal,
	permission: RoutePermission,
	context?: { domainId?: string; mailboxId?: string },
): Response | null {
	if (permission === "public") {
		return null;
	}

	if (principal.kind === "legacy") {
		return null;
	}

	if (principal.kind === "oidc_client") {
		return authorizeClientPrincipal(request, principal, permission);
	}

	if (!principal.accountId) {
		return forbidden(request);
	}

	if (principal.status === "suspended") {
		return problemResponse(401, "Account is suspended", {
			code: "unauthorized",
			instance: requestInstance(request),
		});
	}

	if (principal.status === "pending" && permission !== "authenticated") {
		return forbidden(request);
	}

	if (principal.isIntendant) {
		if (permission === "mail_read" || permission === "mail_write") {
			return forbidden(request);
		}
		return null;
	}

	switch (permission) {
		case "authenticated":
			return null;
		case "platform":
			return isPlatformPrincipal(principal) ? null : forbidden(request);
		case "domain_admin":
			if (isPlatformPrincipal(principal)) {
				return null;
			}
			if (principal.role !== "admin") {
				return forbidden(request);
			}
			if (context?.domainId && !hasDomainAccess(principal, context.domainId)) {
				return forbidden(request);
			}
			return null;
		case "domain_manage_users":
			if (isPlatformPrincipal(principal)) {
				return null;
			}
			if (principal.role !== "admin" && principal.role !== "manager") {
				return forbidden(request);
			}
			if (context?.domainId && !hasDomainAccess(principal, context.domainId)) {
				return forbidden(request);
			}
			return null;
		case "mail_read":
		case "mail_write":
			if (isPlatformPrincipal(principal) || principal.role === "admin") {
				return null;
			}
			if (context?.mailboxId) {
				const allowed = accessibleMailboxIds(principal);
				return allowed.has(context.mailboxId) ? null : forbidden(request);
			}
			return principal.role ? null : forbidden(request);
		default:
			return forbidden(request);
	}
}

function authorizeClientPrincipal(
	request: Request,
	principal: Principal,
	permission: RoutePermission,
): Response | null {
	const perms = new Set(principal.m2mPermissions ?? []);
	if (permission === "mail_read" && perms.has("mail:read")) {
		return null;
	}
	if (permission === "mail_write" && perms.has("mail:send")) {
		return null;
	}
	if (permission === "platform" && perms.has("platform:admin")) {
		return null;
	}
	return forbidden(request);
}

function forbidden(request: Request): Response {
	return problemResponse(403, "You do not have permission to perform this action", {
		code: "forbidden",
		instance: requestInstance(request),
	});
}

export function permissionForPath(
	method: string,
	path: string,
): RoutePermission {
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
		return "domain_admin";
	}
	if (method === "GET" && path === "/api/v1/mailboxes") {
		return "authenticated";
	}
	if (method === "POST" && path === "/api/v1/mailboxes") {
		return "domain_admin";
	}
	if (path.startsWith("/api/v1/mailboxes/")) {
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
