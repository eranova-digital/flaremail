import type { RouteContext } from "../lib/http/router";
import { APP_VERSION } from "../lib/app-version";
import openApiSpec from "../openapi/spec.json";

export async function handleOpenApiJson(_context: RouteContext): Promise<Response> {
	const spec = {
		...openApiSpec,
		info: {
			...openApiSpec.info,
			version: APP_VERSION,
		},
	};
	return Response.json(spec, {
		headers: {
			"Cache-Control": "private, no-store",
		},
	});
}

export async function handleOpenApiYaml(_context: RouteContext): Promise<Response> {
	return Response.redirect("/api/v1/openapi.json", 302);
}
