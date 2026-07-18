import type { Database } from "../../db/client";
import {
	AccountAccessDeniedError,
	assertCanAssignInviteRole,
	assertCanManageAccount,
	assertCanManageTargetSecurity,
	assertCanRemoveAccount,
	assertCanViewAccount,
} from "./account-access";
import {
	assertPrincipalCanAccessMailbox,
	assertPrincipalCanManageDomain,
	assertPrincipalCanManageMailbox,
	collectManageableMailboxIds,
	collectReadableMailboxIds,
	filterMailboxesForPrincipal,
	MailboxAccessDeniedError,
	type MailboxListScope,
} from "./mailbox-access";
import { assertCanSendFrom } from "../authorize-mailbox";
import {
	accessibleMailboxIds,
	hasDomainAccess,
	isPlatformPrincipal,
} from "./principal";
import type {
	AccountOperation,
	AuthAction,
	AuthResource,
	MailboxOperation,
} from "./actions";
import { AuthorizationDeniedError } from "./actions";
import type { AccountRole } from "./types";
import type { Principal } from "./types";

export {
	AccountAccessDeniedError,
	MailboxAccessDeniedError,
	assertPrincipalCanManageDomain,
	collectManageableMailboxIds,
	collectReadableMailboxIds,
	filterMailboxesForPrincipal,
};
export type { MailboxListScope };

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
			if (resource.mailboxId && principal.role === "user") {
				const allowed = accessibleMailboxIds(principal);
				return allowed.has(resource.mailboxId) ? undefined : deny();
			}
			return principal.role || principal.isIntendant ? undefined : deny();
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
 * Resource-level account authorization — single seam for account policy.
 */
export async function authorizeAccount(
	db: Database,
	principal: Principal,
	accountId: string,
	operation: AccountOperation,
	options?: {
		inviteRole?: AccountRole;
		removeTarget?: { isIntendant: boolean; role: AccountRole | null };
	},
): Promise<void> {
	switch (operation) {
		case "view":
			return assertCanViewAccount(db, principal, accountId);
		case "manage":
			return assertCanManageAccount(db, principal, accountId);
		case "manage_security":
			return assertCanManageTargetSecurity(db, principal, accountId);
		case "remove":
			if (!options?.removeTarget) {
				throw new Error("removeTarget is required for remove operation");
			}
			if (principal.accountId !== accountId) {
				await assertCanManageAccount(db, principal, accountId);
			}
			return assertCanRemoveAccount(principal, options.removeTarget);
		case "assign_invite_role":
			if (!options?.inviteRole) {
				throw new Error("inviteRole is required for assign_invite_role operation");
			}
			return assertCanAssignInviteRole(principal, options.inviteRole);
	}
}

/**
 * Resource-level mailbox authorization — single seam for mailbox policy.
 */
export async function authorizeMailbox(
	db: Database,
	principal: Principal,
	mailboxId: string,
	operation: MailboxOperation,
): Promise<void> {
	switch (operation) {
		case "read":
			return assertPrincipalCanAccessMailbox(db, principal, mailboxId);
		case "manage":
			return assertPrincipalCanManageMailbox(db, principal, mailboxId);
		case "send":
			await assertPrincipalCanAccessMailbox(db, principal, mailboxId);
			return assertCanSendFrom(db, mailboxId);
	}
}
