import type { Database } from "../../db/client";
import { assertPrincipalCanAccessMailbox } from "./mailbox-access";
import {
	accessibleMailboxIds,
	hasDomainAccess,
	isPlatformPrincipal,
} from "./principal";
import type { AuthAction, AuthResource } from "./actions";
import { AuthorizationDeniedError } from "./actions";
import type { Principal } from "./types";

function deny(message?: string): never {
	throw new AuthorizationDeniedError(message);
}

function assertOidcScope(principal: Principal, scope: string): void {
	const scopes = new Set(principal.oidcScopes ?? []);
	if (!scopes.has(scope)) {
		deny();
	}
}

function authorizeClientPrincipal(
	principal: Principal,
	action: AuthAction,
): void {
	const perms = new Set(principal.m2mPermissions ?? []);
	if (action === "mail_read" && perms.has("mail:read")) {
		return;
	}
	if (action === "mail_write" && perms.has("mail:send")) {
		return;
	}
	if (action === "platform" && perms.has("platform:admin")) {
		return;
	}
	deny();
}

function authorizeAccountPrincipal(
	principal: Principal,
	action: AuthAction,
	resource: AuthResource,
): void {
	if (!principal.accountId) {
		deny();
	}

	if (principal.status === "suspended") {
		throw new AuthorizationDeniedError("Account is suspended");
	}

	if (principal.status === "pending" && action !== "authenticated") {
		deny();
	}

	if (principal.isIntendant) {
		return;
	}

	if (principal.kind === "oidc_user") {
		if (action === "mail_read") {
			assertOidcScope(principal, "mail:read");
		}
		if (action === "mail_write") {
			assertOidcScope(principal, "mail:send");
		}
	}

	switch (action) {
		case "public":
		case "authenticated":
			return;
		case "platform":
			return isPlatformPrincipal(principal) ? undefined : deny();
		case "domain_admin":
			if (isPlatformPrincipal(principal)) {
				return;
			}
			if (principal.role !== "admin") {
				deny();
			}
			if (resource.domainId && !hasDomainAccess(principal, resource.domainId)) {
				deny();
			}
			return;
		case "domain_manage_users":
			if (isPlatformPrincipal(principal)) {
				return;
			}
			if (principal.role !== "admin" && principal.role !== "manager") {
				deny();
			}
			if (resource.domainId && !hasDomainAccess(principal, resource.domainId)) {
				deny();
			}
			return;
		case "mail_read":
		case "mail_write":
			if (isPlatformPrincipal(principal) || principal.role === "admin") {
				return;
			}
			if (resource.mailboxId) {
				const allowed = accessibleMailboxIds(principal);
				return allowed.has(resource.mailboxId) ? undefined : deny();
			}
			return principal.role ? undefined : deny();
		default:
			deny();
	}
}

/**
 * Unified authorization seam. Callers and tests cross the same interface.
 * Throws AuthorizationDeniedError or MailboxAccessDeniedError on denial.
 */
export function authorize(
	principal: Principal,
	action: AuthAction,
	resource: AuthResource = {},
): void {
	if (action === "public") {
		return;
	}

	if (principal.kind === "legacy") {
		return;
	}

	if (principal.kind === "oidc_client") {
		authorizeClientPrincipal(principal, action);
		return;
	}

	authorizeAccountPrincipal(principal, action, resource);
}

/**
 * Resource-level mailbox check after route authorization passes.
 * Uses DB-backed scope (ADR-0006) instead of in-memory grant sets alone.
 */
export async function authorizeMailboxAccess(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	await assertPrincipalCanAccessMailbox(db, principal, mailboxId);
}
