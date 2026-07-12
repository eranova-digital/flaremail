import { problemResponse, requestInstance } from "../http/problem";
import { actionForPath, AuthorizationDeniedError } from "./actions";
import { authorize, authorizeMailboxAccess } from "./access";
import type { AuthAction, AuthResource } from "./actions";
import type { RoutePermission } from "./types";
import type { Principal } from "./types";

export { actionForPath, AuthorizationDeniedError } from "./actions";
export { authorize, authorizeAccount, authorizeMailbox, authorizeMailboxAccess, authorizeDraftCommand } from "./access";
export type { AccountOperation, MailboxOperation } from "./actions";
export type { AuthAction, AuthResource } from "./actions";

/** @deprecated Use actionForPath — kept for incremental migration. */
export const permissionForPath = actionForPath;

export async function authorizeRequest(
	request: Request,
	principal: Principal,
	action: AuthAction,
	resource: AuthResource = {},
): Promise<Response | null> {
	try {
		authorize(principal, action, resource);
		return null;
	} catch (error) {
		if (error instanceof AuthorizationDeniedError) {
			const status = error.message === "Account is suspended" ? 401 : 403;
			const code = status === 401 ? "unauthorized" : "forbidden";
			return problemResponse(status, error.message, {
				code,
				instance: requestInstance(request),
			});
		}
		throw error;
	}
}

/** @deprecated Use authorizeRequest — kept for incremental migration. */
export async function authorizePrincipal(
	request: Request,
	principal: Principal,
	permission: RoutePermission,
	context?: { domainId?: string; mailboxId?: string },
): Promise<Response | null> {
	return authorizeRequest(request, principal, permission, context ?? {});
}
