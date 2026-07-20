import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	sendRecoveryEmailSetupCode,
	verifyAndSetRecoveryEmail,
} from "../services/recovery-email";
import { createTransactionalEmailDeps } from "../services/transactional-email-deps";

export async function handleSendRecoveryEmailCode(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.email !== "string" || !value.email.trim()) {
		return validationError(context.request, "email is required");
	}
	try {
		await withDb(context.env, (db) =>
			sendRecoveryEmailSetupCode(
				db,
				createTransactionalEmailDeps(context.env),
				{
					accountId: context.principal.accountId!,
					recoveryAddress: value.email as string,
				},
			),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleVerifyRecoveryEmail(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (
		typeof value.email !== "string" ||
		!value.email.trim() ||
		typeof value.code !== "string"
	) {
		return validationError(context.request, "email and code are required");
	}
	try {
		await withDb(context.env, (db) =>
			verifyAndSetRecoveryEmail(db, {
				accountId: context.principal.accountId!,
				recoveryAddress: value.email as string,
				code: value.code as string,
			}),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
