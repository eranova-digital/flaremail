import { requireAuth } from "./auth";
import { handleRouteError } from "./handle-route-error";

export type RouteContext = {
	request: Request;
	env: Env;
	params: Record<string, string>;
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

			if (route.auth) {
				const authError = requireAuth(request, env);
				if (authError) {
					return authError;
				}
			}

			const params: Record<string, string> = {};
			for (const [index, name] of route.paramNames.entries()) {
				params[name] = match[index + 1];
			}

			try {
				return await route.handler({ request, env, params });
			} catch (error) {
				console.error(`Route error ${request.method} ${pathname}:`, error);
				return handleRouteError(error, request);
			}
		}

		return null;
	};
}
