import { withDb } from "../db/client";
import { listGrantableApiKeyScopes } from "../lib/auth/api-key-scopes";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { problemResponse, requestInstance } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	createApiKey,
	listApiKeys,
	revokeApiKey,
} from "../services/api-keys";

function requireSessionPrincipal(context: RouteContext): Response | null {
	if (context.principal.kind !== "session" || !context.principal.accountId) {
		return problemResponse(403, "This endpoint requires an authenticated session", {
			code: "forbidden",
			instance: requestInstance(context.request),
		});
	}
	return null;
}

export async function handleListApiKeys(context: RouteContext) {
	const sessionError = requireSessionPrincipal(context);
	if (sessionError) {
		return sessionError;
	}
	try {
		const items = await withDb(context.env, (db) =>
			listApiKeys(db, context.principal.accountId!),
		);
		return jsonResponse({
			items,
			availableScopes: listGrantableApiKeyScopes(context.principal),
		});
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleCreateApiKey(context: RouteContext) {
	const sessionError = requireSessionPrincipal(context);
	if (sessionError) {
		return sessionError;
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	const name = typeof value.name === "string" ? value.name : "API key";
	const scopes = Array.isArray(value.scopes)
		? value.scopes.filter((scope): scope is string => typeof scope === "string")
		: [];
	try {
		const result = await withDb(context.env, (db) =>
			createApiKey(db, {
				accountId: context.principal.accountId!,
				name,
				scopes,
				principal: context.principal,
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeApiKey(context: RouteContext) {
	const sessionError = requireSessionPrincipal(context);
	if (sessionError) {
		return sessionError;
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
