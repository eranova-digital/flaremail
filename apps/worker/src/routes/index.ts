import { createRouter } from "../lib/http/router";
import { problemResponse, requestInstance } from "../lib/http/problem";
import { handleHealthRequest } from "./health";
import { handleOpenApiJson } from "./openapi";
import { authRoutes } from "./auth";
import { v1Routes } from "./v1";

export const apiRouter = createRouter([
	{
		method: "GET",
		path: "/api/v1/openapi.json",
		auth: false,
		handler: handleOpenApiJson,
	},
	...authRoutes,
	...v1Routes,
]);

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
