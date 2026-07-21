import { resolvePrincipal as resolvePrincipalLib } from "../lib/auth/resolve-principal";
import { createRouter } from "../lib/http/router";
import { problemResponse, requestInstance } from "../lib/http/problem";
import { touchSession } from "../services/auth-session";
import { handleHealthRequest } from "./health";
import { healthRoutes } from "./health-routes";
import { handleOpenApiJson } from "./openapi";
import { bootstrapRoutes } from "./bootstrap";
import { authRoutes } from "./auth";
import { v1Routes } from "./v1";

export const apiRouter = createRouter(
	[
		{
			method: "GET",
			path: "/api/v1/openapi.json",
			auth: false,
			handler: handleOpenApiJson,
		},
		...healthRoutes,
		...bootstrapRoutes,
		...authRoutes,
		...v1Routes,
	],
	{
		resolvePrincipal: (request, env) =>
			resolvePrincipalLib(request, env, { touchSession }),
	},
);

export function handleFetchRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (url.pathname === "/health") {
		return Promise.resolve(handleHealthRequest());
	}

	return apiRouter(request, env).then(
		(response) =>
			response ??
			problemResponse(404, "The requested resource was not found", {
				code: "not-found",
				instance: requestInstance(request),
			}),
	);
}
