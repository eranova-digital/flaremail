import { actionForPath, authorizeRequest } from "../auth/authorize";
import { resolvePrincipal } from "../auth/resolve-principal";
import type { Principal } from "../auth/types";
import { handleRouteError } from "./handle-route-error";

export type RouteContext = {
	request: Request;
	env: Env;
	params: Record<string, string>;
	principal: Principal;
};

export type RouteHandler = (context: RouteContext) => Promise<Response>;

export type RouteDefinition = {
	method: string;
	path: string;
	auth?: boolean;
	handler: RouteHandler;
};

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

export function createRouter(routes: RouteDefinition[]) {
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

				const action = actionForPath(route.method, pathname);
				const authzError = await authorizeRequest(request, principal, action, {
					mailboxId: params.mailboxId,
					domainId:
						params.domainId ??
						(route.path.includes("/domains/") ? params.id : undefined),
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
