import type { RouteDefinition } from "../lib/http/router";
import { handleBootstrapPost } from "../controllers/bootstrap";

const prefix = "/api/v1";

export const bootstrapRoutes: RouteDefinition[] = [
	{
		method: "POST",
		path: `${prefix}/bootstrap`,
		auth: false,
		authRateLimit: true,
		handler: handleBootstrapPost,
	},
];
