import { describe, expect, it } from "vitest";

import spec from "../src/openapi/spec.json";
import { authRoutes } from "../src/routes/auth";
import { bootstrapRoutes } from "../src/routes/bootstrap";
import { healthRoutes } from "../src/routes/health-routes";
import { v1Routes } from "../src/routes/v1";

type OpenApiSpec = {
	paths: Record<string, Record<string, unknown>>;
};

const openApi = spec as OpenApiSpec;

const documentedRoutes = [
	{ method: "GET", path: "/api/v1/openapi.json" },
	...healthRoutes,
	...bootstrapRoutes,
	...authRoutes,
	...v1Routes,
];

function toOpenApiPath(routePath: string): string {
	if (routePath.startsWith("/.well-known/")) {
		return routePath;
	}
	const stripped = routePath.replace(/^\/api\/v1/, "") || "/";
	return stripped.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

describe("OpenAPI coverage", () => {
	it("documents every HTTP route", () => {
		const missing: string[] = [];
		for (const route of documentedRoutes) {
			const path = toOpenApiPath(route.path);
			const method = route.method.toLowerCase();
			const operations = openApi.paths[path];
			if (!operations || operations[method] == null) {
				missing.push(`${route.method} ${path}`);
			}
		}
		expect(missing).toEqual([]);
	});

	it("uses unique operationIds", () => {
		const ids: string[] = [];
		for (const operations of Object.values(openApi.paths)) {
			for (const operation of Object.values(operations)) {
				if (
					operation &&
					typeof operation === "object" &&
					"operationId" in operation &&
					typeof operation.operationId === "string"
				) {
					ids.push(operation.operationId);
				}
			}
		}
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
