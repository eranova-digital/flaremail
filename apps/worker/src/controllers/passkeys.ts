import { withDb } from "../db/client";
import { resolveWebAuthnConfig } from "../lib/auth/webauthn-config";
import { extractSessionMetadata } from "../lib/auth/session-metadata";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import { rejectIfAuthFailureLimited } from "../lib/http/rate-limit";
import type { RouteContext } from "../lib/http/router";
import { sessionSecretForEnv } from "../services/auth";

/** Dynamic import keeps @simplewebauthn out of the static workers test graph. */
function passkeys() {
	return import("../services/passkeys");
}

function jsonWithCookie(data: unknown, cookieHeader: string): Response {
	return Response.json(data, {
		status: 200,
		headers: {
			"Cache-Control": "no-store",
			"Set-Cookie": cookieHeader,
		},
	});
}

export async function handleListPasskeys(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const { listPasskeys } = await passkeys();
		const items = await withDb(context.env, (db) =>
			listPasskeys(db, context.principal.accountId!),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleBeginPasskeyRegistration(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const { beginPasskeyRegistration } = await passkeys();
		const result = await withDb(context.env, (db) =>
			beginPasskeyRegistration(db, {
				accountId: context.principal.accountId!,
				encryptionKey: sessionSecretForEnv(context.env),
				config: resolveWebAuthnConfig(context.request),
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleCompletePasskeyRegistration(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.challengeToken !== "string" || value.response === undefined) {
		return validationError(
			context.request,
			"challengeToken and response are required",
		);
	}
	try {
		const { completePasskeyRegistration } = await passkeys();
		const items = await withDb(context.env, (db) =>
			completePasskeyRegistration(db, {
				accountId: context.principal.accountId!,
				challengeToken: value.challengeToken,
				response: value.response,
				name: typeof value.name === "string" ? value.name : undefined,
				encryptionKey: sessionSecretForEnv(context.env),
				config: resolveWebAuthnConfig(context.request),
			}),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleBeginPasskeySignIn(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	const loginIdentifier =
		typeof value.email === "string" ? value.email : undefined;
	try {
		const { beginPasskeySignIn } = await passkeys();
		const result = await withDb(context.env, (db) =>
			beginPasskeySignIn(db, {
				loginIdentifier,
				encryptionKey: sessionSecretForEnv(context.env),
				config: resolveWebAuthnConfig(context.request),
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		const limited = await rejectIfAuthFailureLimited(
			context.env,
			context.request,
			loginIdentifier,
		);
		if (limited) {
			return limited;
		}
		return handleRouteError(error, context.request);
	}
}

export async function handleCompletePasskeySignIn(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.challengeToken !== "string" || value.response === undefined) {
		return validationError(
			context.request,
			"challengeToken and response are required",
		);
	}
	try {
		const { completePasskeySignIn } = await passkeys();
		const sessionMetadata = extractSessionMetadata(context.request);
		const result = await withDb(context.env, (db) =>
			completePasskeySignIn(
				db,
				{
					challengeToken: value.challengeToken,
					response: value.response,
					encryptionKey: sessionSecretForEnv(context.env),
					config: resolveWebAuthnConfig(context.request),
				},
				sessionMetadata,
			),
		);
		return jsonWithCookie({ ok: true }, result.cookieHeader);
	} catch (error) {
		const limited = await rejectIfAuthFailureLimited(
			context.env,
			context.request,
			typeof value.email === "string"
				? value.email
				: (value.challengeToken as string),
		);
		if (limited) {
			return limited;
		}
		return handleRouteError(error, context.request);
	}
}

export async function handleRemovePasskey(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const passkeyId = context.params.id;
	if (!passkeyId) {
		return validationError(context.request, "Passkey id is required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.password !== "string") {
		return validationError(context.request, "password is required");
	}
	try {
		const { removePasskey } = await passkeys();
		const items = await withDb(context.env, (db) =>
			removePasskey(db, {
				accountId: context.principal.accountId!,
				passkeyId,
				password: value.password,
			}),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
