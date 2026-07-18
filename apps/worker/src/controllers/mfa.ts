import { withDb } from "../db/client";
import { extractSessionMetadata } from "../lib/auth/session-metadata";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import { rejectIfAuthFailureLimited } from "../lib/http/rate-limit";
import type { RouteContext } from "../lib/http/router";
import { loadAccountProfile } from "../lib/auth/principal";
import { parseLogContextFromRequest } from "../lib/logs/request-context";
import { sessionSecretForEnv } from "../services/auth";
import {
	confirmMfa,
	disableMfa,
	getMfaStatus,
	setupMfa,
	verifyMfaSignIn,
} from "../services/mfa";
import { sendMfaDisableRecoveryCode } from "../services/recovery-email";
import { createTransactionalEmailDeps } from "../services/transactional-email-deps";

function jsonWithCookie(data: unknown, cookieHeader: string): Response {
	return Response.json(data, {
		status: 200,
		headers: {
			"Cache-Control": "no-store",
			"Set-Cookie": cookieHeader,
		},
	});
}

export async function handleGetMfaStatus(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const status = await withDb(context.env, (db) =>
			getMfaStatus(db, context.principal.accountId!),
		);
		return jsonResponse(status);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleSetupMfa(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const setup = await withDb(context.env, (db) =>
			setupMfa(db, {
				accountId: context.principal.accountId!,
				encryptionKey: sessionSecretForEnv(context.env),
			}),
		);
		return jsonResponse(setup);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleConfirmMfa(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.code !== "string") {
		return validationError(context.request, "code is required");
	}
	try {
		const status = await withDb(context.env, (db) =>
			confirmMfa(db, {
				accountId: context.principal.accountId!,
				code: value.code,
				encryptionKey: sessionSecretForEnv(context.env),
			}),
		);
		return jsonResponse(status);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleDisableMfa(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.password !== "string" || typeof value.code !== "string") {
		return validationError(context.request, "password and code are required");
	}
	try {
		const status = await withDb(context.env, (db) =>
			disableMfa(db, {
				accountId: context.principal.accountId!,
				password: value.password,
				code: value.code,
				encryptionKey: sessionSecretForEnv(context.env),
			}),
		);
		return jsonResponse(status);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleSendMfaDisableRecoveryCode(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		await withDb(context.env, async (db) => {
			const profile = await loadAccountProfile(db, context.principal.accountId!);
			const recoveryAddress = profile?.recoveryAddress?.trim();
			if (!recoveryAddress) {
				throw new Error("No recovery email configured");
			}
			await sendMfaDisableRecoveryCode(
				db,
				createTransactionalEmailDeps(context.env),
				context.principal.accountId!,
				recoveryAddress,
			);
		});
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleVerifyMfaSignIn(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.mfaToken !== "string" || typeof value.code !== "string") {
		return validationError(context.request, "mfaToken and code are required");
	}
	const encryptionKey = sessionSecretForEnv(context.env);
	try {
		const sessionMetadata = extractSessionMetadata(context.request);
		const result = await withDb(context.env, (db) =>
			verifyMfaSignIn(
				db,
				{
					mfaToken: value.mfaToken as string,
					code: value.code as string,
					encryptionKey,
				},
				sessionMetadata,
				parseLogContextFromRequest(context.request),
			),
		);
		return jsonWithCookie({ ok: true }, result.cookieHeader);
	} catch (error) {
		const limited = await rejectIfAuthFailureLimited(
			context.env,
			context.request,
			value.mfaToken as string,
		);
		if (limited) {
			return limited;
		}
		return handleRouteError(error, context.request);
	}
}
