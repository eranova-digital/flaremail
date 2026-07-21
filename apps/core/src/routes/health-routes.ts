import type { RouteDefinition } from "../lib/http/router";
import { handleHealthRequest } from "./health";

const prefix = "/api/v1";

/** Unauthenticated liveness + version for gate-proxied clients. */
export const healthRoutes: RouteDefinition[] = [
	{
		method: "GET",
		path: `${prefix}/health`,
		auth: false,
		handler: async () => handleHealthRequest(),
	},
];
