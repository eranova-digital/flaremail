import { problemResponse, requestInstance } from "../http/problem";
import type { ApiKeyScope } from "./api-key-scopes";
import { AuthorizationDeniedError } from "./actions";
import { authorize, authorizeMailboxAccess } from "./access";
import type { AuthAction, AuthResource } from "./actions";
import type { RoutePermission } from "./types";
import type { Principal } from "./types";

export { AuthorizationDeniedError } from "./actions";
export {
	authorize,
	authorizeAccount,
	authorizeMailbox,
	authorizeMailboxAccess,
	authorizeDraftCommand,
} from "./access";
export type { AccountOperation, MailboxOperation } from "./actions";
export type { AuthAction, AuthResource } from "./actions";

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

export type ApiKeyScopeContext = {
	routePath: string;
	params: Record<string, string>;
};

/**
 * Resolve required scopes for an API key on a route.
 * Temporary self/other profile-picture override until contextual scopes land on RouteDefinition.
 */
export function resolveApiKeyScopesForRoute(
	scopes: readonly ApiKeyScope[] | null,
	principal: Principal,
	context: ApiKeyScopeContext,
): readonly ApiKeyScope[] | null {
	if (
		context.routePath === "/api/v1/accounts/:id/profile-picture" &&
		principal.accountId &&
		context.params.id === principal.accountId
	) {
		return ["profile_picture:read"];
	}
	return scopes;
}

export function authorizeApiKeyRoute(
	request: Request,
	principal: Principal,
	scopes: readonly ApiKeyScope[] | null,
	context: ApiKeyScopeContext,
): Response | null {
	if (principal.kind !== "api_key") {
		return null;
	}

	const requiredScopes = resolveApiKeyScopesForRoute(scopes, principal, context);
	if (!requiredScopes || requiredScopes.length === 0) {
		return problemResponse(403, "API keys cannot access this endpoint", {
			code: "forbidden",
			instance: requestInstance(request),
		});
	}

	const held = new Set(principal.apiKeyScopes ?? []);
	if (requiredScopes.some((scope) => held.has(scope))) {
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
