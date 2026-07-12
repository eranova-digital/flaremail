import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import { createApiKey, listApiKeys, revokeApiKey } from "../services/api-keys";

export async function handleListApiKeys(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const items = await withDb(context.env, (db) =>
			listApiKeys(db, context.principal.accountId!),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleCreateApiKey(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	const name = typeof value.name === "string" ? value.name : "API key";
	try {
		const result = await withDb(context.env, (db) =>
			createApiKey(db, context.principal.accountId!, name),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeApiKey(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		await withDb(context.env, (db) =>
			revokeApiKey(db, context.principal.accountId!, context.params.id),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
