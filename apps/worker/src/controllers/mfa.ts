import { eq } from "drizzle-orm";

import { withDb } from "../db/client";
import { accounts } from "../db/schema";
import { extractSessionMetadata } from "../lib/auth/session-metadata";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import { loadAccountProfile } from "../lib/auth/principal";
import { sessionSecretForEnv } from "../services/auth";
import {
	completeMfaSignIn,
	confirmMfa,
	disableMfa,
	getMfaStatus,
	setupMfa,
} from "../services/mfa";
import { sendMfaDisableRecoveryCode } from "../services/recovery-email";

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
		const setup = await withDb(context.env, async (db) => {
			const [account] = await db
				.select({ loginIdentifier: accounts.loginIdentifier })
				.from(accounts)
				.where(eq(accounts.id, context.principal.accountId!))
				.limit(1);
			if (!account) {
				throw new Error("Account not found");
			}
			return setupMfa(db, {
				accountId: context.principal.accountId!,
				loginIdentifier: account.loginIdentifier,
				encryptionKey: sessionSecretForEnv(context.env),
			});
		});
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
				{
					email: context.env.EMAIL,
					bucket: context.env.BUCKET,
				},
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
	try {
		const sessionMetadata = extractSessionMetadata(context.request);
		const result = await withDb(context.env, (db) =>
			completeMfaSignIn(
				db,
				{
					mfaToken: value.mfaToken,
					code: value.code,
					encryptionKey: sessionSecretForEnv(context.env),
				},
				sessionMetadata,
			),
		);
		return jsonWithCookie({ ok: true }, result.cookieHeader);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
