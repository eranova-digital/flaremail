import type { RouteContext } from "../lib/http/router";
import openApiSpec from "../openapi/spec.json";

export async function handleOpenApiJson(_context: RouteContext): Promise<Response> {
	return Response.json(openApiSpec, {
		headers: {
			"Cache-Control": "private, no-store",
		},
	});
}

export async function handleOpenApiYaml(_context: RouteContext): Promise<Response> {
	return Response.redirect("/api/v1/openapi.json", 302);
}
