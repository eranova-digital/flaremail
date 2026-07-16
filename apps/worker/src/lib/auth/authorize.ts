import { problemResponse, requestInstance } from "../http/problem";
import { apiKeyScopesForRoute } from "./api-key-scopes";
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

export function authorizeApiKeyRoute(
	request: Request,
	principal: Principal,
	method: string,
	routePath: string,
	params: Record<string, string> = {},
): Response | null {
	if (principal.kind !== "api_key") {
		return null;
	}

	const requiredScopes = apiKeyScopesForRoute(method, routePath, {
		principal,
		params,
	});
	if (!requiredScopes) {
		return problemResponse(403, "API keys cannot access this endpoint", {
			code: "forbidden",
			instance: requestInstance(request),
		});
	}

	const scopes = new Set(principal.apiKeyScopes ?? []);
	if (requiredScopes.some((scope) => scopes.has(scope))) {
		return null;
	}

	const scopeList = requiredScopes.join("' or '");
	return problemResponse(403, `API key scope '${scopeList}' is required`, {
		code: "forbidden",
		instance: requestInstance(request),
	});
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
