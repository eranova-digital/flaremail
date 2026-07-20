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
