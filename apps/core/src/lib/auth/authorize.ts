import { problemResponse, requestInstance } from "../http/problem";
import type { ApiKeyScope } from "./api-key-scopes";
import { AuthorizationDeniedError } from "./actions";
import { authorize } from "./access";
import type { AuthAction, AuthResource } from "./actions";
import type { Principal } from "./types";

export type AuthorizeRouteInput = {
	action: AuthAction;
	scopes?: readonly ApiKeyScope[] | null;
	routePath: string;
	params: Record<string, string>;
	resource?: AuthResource;
};

function authorizeApiKeyScopes(
	request: Request,
	principal: Principal,
	scopes: readonly ApiKeyScope[] | null | undefined,
): Response | null {
	if (principal.kind !== "api_key") {
		return null;
	}

	if (!scopes || scopes.length === 0) {
		return problemResponse(403, "API keys cannot access this endpoint", {
			code: "api-keys-cannot-access",
			instance: requestInstance(request),
		});
	}

	const held = new Set(principal.apiKeyScopes ?? []);
	if (scopes.some((scope) => held.has(scope))) {
		return null;
	}

	const scopeList = scopes.join("' or '");
	return problemResponse(403, `API key scope '${scopeList}' is required`, {
		code: "api-key-scope-required",
		instance: requestInstance(request),
	});
}

/**
 * Single request-authz seam: coarse RBAC then API key scopes.
 */
export async function authorizeRoute(
	request: Request,
	principal: Principal,
	input: AuthorizeRouteInput,
): Promise<Response | null> {
	try {
		authorize(principal, input.action, input.resource ?? {});
	} catch (error) {
		if (error instanceof AuthorizationDeniedError) {
			const status = error.message === "Account is suspended" ? 401 : 403;
			const code =
				error.message === "Account is suspended"
					? "account-suspended"
					: "forbidden";
			return problemResponse(status, error.message, {
				code,
				instance: requestInstance(request),
			});
		}
		throw error;
	}

	return authorizeApiKeyScopes(request, principal, input.scopes);
}
