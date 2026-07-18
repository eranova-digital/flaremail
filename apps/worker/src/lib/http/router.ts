import type { AuthAction } from "../auth/actions";
import type { ApiKeyScope } from "../auth/api-key-scopes";
import type { Principal } from "../auth/types";
import { authorizeRoute } from "../auth/authorize";
import {
	resolvePrincipal as defaultResolvePrincipal,
	type ResolvePrincipalDeps,
} from "../auth/resolve-principal";
import { handleRouteError } from "./handle-route-error";

export type RouteContext = {
	request: Request;
	env: Env;
	params: Record<string, string>;
	principal: Principal;
};

export type RouteHandler = (context: RouteContext) => Promise<Response>;

export type RouteScopeResolver = (context: {
	principal: Principal;
	params: Record<string, string>;
}) => readonly ApiKeyScope[] | null;

/**
 * Route capability registry entry.
 * - `action`: coarse RBAC check
 * - `scopes`: API key scopes (any-of), or a resolver for contextual scopes.
 *   Omit/`null` on authenticated routes → API keys forbidden.
 */
export type RouteDefinition = {
	method: string;
	path: string;
	auth?: boolean;
	action?: AuthAction;
	scopes?: readonly ApiKeyScope[] | null | RouteScopeResolver;
	handler: RouteHandler;
};

export type CreateRouterOptions = {
	resolvePrincipal?: (
		request: Request,
		env: Env,
		deps?: ResolvePrincipalDeps,
	) => Promise<Principal | Response>;
};

export function resolveRouteScopes(
	scopes: RouteDefinition["scopes"],
	principal: Principal,
	params: Record<string, string>,
): readonly ApiKeyScope[] | null {
	if (typeof scopes === "function") {
		return scopes({ principal, params });
	}
	return scopes ?? null;
}

function pathToPattern(path: string): {
	pattern: RegExp;
	paramNames: string[];
} {
	const paramNames: string[] = [];
	const pattern = path
		.split("/")
		.map((segment) => {
			if (segment.startsWith(":")) {
				paramNames.push(segment.slice(1));
				return "([^/]+)";
			}

			return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		})
		.join("/");

	return {
		pattern: new RegExp(`^${pattern}$`),
		paramNames,
	};
}

export function createRouter(
	routes: RouteDefinition[],
	options: CreateRouterOptions = {},
) {
	const resolvePrincipal = options.resolvePrincipal ?? defaultResolvePrincipal;
	const compiled = routes.map((route) => ({
		...route,
		...pathToPattern(route.path),
		auth: route.auth ?? true,
	}));

	return async (request: Request, env: Env): Promise<Response | null> => {
		const url = new URL(request.url);
		const pathname = url.pathname.replace(/\/+$/, "") || "/";

		for (const route of compiled) {
			if (route.method !== request.method) {
				continue;
			}

			const match = pathname.match(route.pattern);
			if (!match) {
				continue;
			}

			const params: Record<string, string> = {};
			for (const [index, name] of route.paramNames.entries()) {
				params[name] = match[index + 1];
			}

			let principal: Principal = {
				kind: "legacy",
				accountId: null,
				isIntendant: false,
				role: null,
				status: null,
				loginIdentifier: null,
				primaryMailboxId: null,
				domainIds: [],
				grantMailboxIds: [],
				sharedMailboxAssignment: [],
			};

			if (route.auth) {
				const principalResult = await resolvePrincipal(request, env);
				if (principalResult instanceof Response) {
					return principalResult;
				}
				principal = principalResult;

				const action = route.action ?? "authenticated";
				const authzError = await authorizeRoute(request, principal, {
					action,
					scopes: resolveRouteScopes(route.scopes, principal, params),
					routePath: route.path,
					params,
					resource: {
						mailboxId: params.mailboxId,
						domainId:
							params.domainId ??
							(route.path.includes("/domains/") ? params.id : undefined),
					},
				});
				if (authzError) {
					return authzError;
				}
			}

			try {
				return await route.handler({ request, env, params, principal });
			} catch (error) {
				console.error(`Route error ${request.method} ${pathname}:`, error);
				return handleRouteError(error, request);
			}
		}

		return null;
	};
}
