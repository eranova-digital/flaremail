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
import {
	parseLogContextFromRequest,
	safeEmitLog,
} from "../services/logs";

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
	const accountId = context.principal.accountId!;
	try {
		const result = await withDb(context.env, async (db) => {
			const created = await createApiKey(db, {
				accountId,
				name,
				scopes,
				principal: context.principal,
			});
			await safeEmitLog(db, {
				importance: 4,
				type: "api-keys",
				summary: "{actor} created API key {key}",
				refs: {
					actor: { kind: "account", id: accountId },
					key: { kind: "api-key", id: created.id },
				},
				actorAccountId: accountId,
				context: parseLogContextFromRequest(context.request),
			});
			return created;
		});
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
	const accountId = context.principal.accountId!;
	const keyId = context.params.id;
	try {
		await withDb(context.env, async (db) => {
			const revoked = await revokeApiKey(db, accountId, keyId);
			if (revoked) {
				await safeEmitLog(db, {
					importance: 4,
					type: "api-keys",
					summary: "{actor} revoked API key {key}",
					refs: {
						actor: { kind: "account", id: accountId },
						key: { kind: "api-key", id: keyId },
					},
					actorAccountId: accountId,
					context: parseLogContextFromRequest(context.request),
				});
			}
		});
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
