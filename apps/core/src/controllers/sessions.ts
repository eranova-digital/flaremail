import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	listActiveSessions,
	revokeAllSessions,
	revokeSession,
} from "../services/auth-session";

function jsonWithOptionalCookie(
	data: unknown,
	cookieHeader: string | null,
): Response {
	if (!cookieHeader) {
		return jsonResponse(data);
	}
	return Response.json(data, {
		status: 200,
		headers: {
			"Cache-Control": "no-store",
			"Set-Cookie": cookieHeader,
		},
	});
}

export async function handleListSessions(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const items = await withDb(context.env, (db) =>
			listActiveSessions(
				db,
				context.principal.accountId!,
				context.principal.sessionId,
			),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeSession(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const result = await withDb(context.env, (db) =>
			revokeSession(
				db,
				context.principal.accountId!,
				context.params.id,
				context.principal.sessionId,
			),
		);
		return jsonWithOptionalCookie(
			{ ok: true, signedOutCurrent: result.signedOutCurrent },
			result.cookieHeader,
		);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeAllSessions(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const includeCurrent =
		new URL(context.request.url).searchParams.get("includeCurrent") === "true";
	try {
		const result = await withDb(context.env, (db) =>
			revokeAllSessions(db, context.principal.accountId!, {
				includeCurrent,
				currentSessionId: context.principal.sessionId,
			}),
		);
		return jsonWithOptionalCookie(
			{ ok: true, signedOutCurrent: result.signedOutCurrent },
			result.cookieHeader,
		);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
