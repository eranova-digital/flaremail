import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import { ensureIntendantBootstrapped } from "../services/intendant-bootstrap";

export async function handleBootstrapPost(context: RouteContext) {
	if (context.request.method !== "POST") {
		return validationError(context.request, "Method not allowed");
	}

	try {
		const result = await withDb(context.env, (db) =>
			ensureIntendantBootstrapped(db),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
