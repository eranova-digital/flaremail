import { withDb } from "../db/client";
import { parseCookies, SESSION_COOKIE_NAME } from "../lib/auth/cookies";
import { extractSessionMetadata } from "../lib/auth/session-metadata";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	activateInvite,
	getMe,
	previewInvite,
	regenerateIntendantPassword,
	requestPasswordReset,
	resetPasswordWithCode,
	sessionSecretForEnv,
	signIn,
	signOut,
} from "../services/auth";
import { updateAccountProfile } from "../services/accounts";

function jsonWithCookie(data: unknown, cookieHeader: string): Response {
	return Response.json(data, {
		status: 200,
		headers: {
			"Cache-Control": "no-store",
			"Set-Cookie": cookieHeader,
		},
	});
}

export async function handleSignIn(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.email !== "string" || typeof value.password !== "string") {
		return validationError(context.request, "email and password are required");
	}
	try {
		const sessionMetadata = extractSessionMetadata(context.request);
		const result = await withDb(context.env, (db) =>
			signIn(
				db,
				{
					loginIdentifier: value.email as string,
					password: value.password as string,
				},
				sessionSecretForEnv(context.env),
				sessionMetadata,
			),
		);
		if (result.requiresMfa) {
			return jsonResponse({
				requiresMfa: true,
				mfaToken: result.mfaToken,
			});
		}
		return jsonWithCookie({ ok: true }, result.cookieHeader);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleSignOut(context: RouteContext) {
	const cookies = parseCookies(context.request.headers.get("Cookie"));
	const token = cookies[SESSION_COOKIE_NAME];
	if (token) {
		const cookieHeader = await withDb(context.env, (db) => signOut(db, token));
		return jsonWithCookie({ ok: true }, cookieHeader);
	}
	return jsonResponse({ ok: true });
}

export async function handlePreviewInvite(context: RouteContext) {
	const code = new URL(context.request.url).searchParams.get("code");
	if (!code?.trim()) {
		return validationError(context.request, "code query parameter is required");
	}
	try {
		const preview = await withDb(context.env, (db) => previewInvite(db, code));
		return jsonResponse(preview);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleActivateInvite(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.code !== "string" || typeof value.password !== "string") {
		return validationError(context.request, "code and password are required");
	}

	const profile =
		value.profile && typeof value.profile === "object"
			? (value.profile as Record<string, unknown>)
			: value;

	try {
		const sessionMetadata = extractSessionMetadata(context.request);
		const result = await withDb(context.env, (db) =>
			activateInvite(db, {
				code: value.code as string,
				password: value.password as string,
				profile: {
					firstName:
						typeof profile.firstName === "string"
							? profile.firstName
							: undefined,
					lastName:
						typeof profile.lastName === "string"
							? profile.lastName
							: undefined,
					recoveryAddress:
						profile.recoveryAddress === null
							? null
							: typeof profile.recoveryAddress === "string"
								? profile.recoveryAddress
								: undefined,
					phone:
						profile.phone === null
							? null
							: typeof profile.phone === "string"
								? profile.phone
								: undefined,
					addressCountry:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).country === null
								? null
								: typeof (profile.address as Record<string, unknown>).country ===
									  "string"
									? ((profile.address as Record<string, unknown>)
											.country as string)
									: undefined)
							: typeof profile.addressCountry === "string"
								? profile.addressCountry
								: undefined,
					addressState:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).state === null
								? null
								: typeof (profile.address as Record<string, unknown>).state ===
									  "string"
									? ((profile.address as Record<string, unknown>).state as string)
									: undefined)
							: typeof profile.addressState === "string"
								? profile.addressState
								: undefined,
					addressCity:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).city === null
								? null
								: typeof (profile.address as Record<string, unknown>).city ===
									  "string"
									? ((profile.address as Record<string, unknown>).city as string)
									: undefined)
							: typeof profile.addressCity === "string"
								? profile.addressCity
								: undefined,
					addressLine1:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).line1 === null
								? null
								: typeof (profile.address as Record<string, unknown>).line1 ===
									  "string"
									? ((profile.address as Record<string, unknown>).line1 as string)
									: undefined)
							: typeof profile.addressLine1 === "string"
								? profile.addressLine1
								: undefined,
					addressLine2:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).line2 === null
								? null
								: typeof (profile.address as Record<string, unknown>).line2 ===
									  "string"
									? ((profile.address as Record<string, unknown>).line2 as string)
									: undefined)
							: typeof profile.addressLine2 === "string"
								? profile.addressLine2
								: undefined,
				},
			}, sessionMetadata),
		);
		return jsonWithCookie({ ok: true }, result.cookieHeader);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleForgotPassword(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.address !== "string") {
		return validationError(context.request, "address is required");
	}
	try {
		const result = await withDb(context.env, (db) =>
			requestPasswordReset(db, context.env.EMAIL, { address: value.address as string }),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleResetPassword(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.code !== "string" || typeof value.password !== "string") {
		return validationError(context.request, "code and password are required");
	}
	try {
		await withDb(context.env, (db) =>
			resetPasswordWithCode(db, {
				code: value.code as string,
				password: value.password as string,
			}),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetMe(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const me = await withDb(context.env, (db) =>
			getMe(db, context.principal.accountId!),
		);
		return jsonResponse(me);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUpdateMe(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	const profile =
		value.profile && typeof value.profile === "object"
			? (value.profile as Record<string, unknown>)
			: value;

	try {
		const account = await withDb(context.env, (db) =>
			updateAccountProfile(db, context.principal, context.principal.accountId!, {
				profile: {
					firstName:
						typeof profile.firstName === "string"
							? profile.firstName
							: undefined,
					lastName:
						typeof profile.lastName === "string"
							? profile.lastName
							: undefined,
					recoveryAddress:
						profile.recoveryAddress === null
							? null
							: typeof profile.recoveryAddress === "string"
								? profile.recoveryAddress
								: undefined,
					phone:
						profile.phone === null
							? null
							: typeof profile.phone === "string"
								? profile.phone
								: undefined,
					addressCountry:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).country === null
								? null
								: typeof (profile.address as Record<string, unknown>).country ===
									  "string"
									? ((profile.address as Record<string, unknown>)
											.country as string)
									: undefined)
							: undefined,
					addressState:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).state === null
								? null
								: typeof (profile.address as Record<string, unknown>).state ===
									  "string"
									? ((profile.address as Record<string, unknown>).state as string)
									: undefined)
							: undefined,
					addressCity:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).city === null
								? null
								: typeof (profile.address as Record<string, unknown>).city ===
									  "string"
									? ((profile.address as Record<string, unknown>).city as string)
									: undefined)
							: undefined,
					addressLine1:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).line1 === null
								? null
								: typeof (profile.address as Record<string, unknown>).line1 ===
									  "string"
									? ((profile.address as Record<string, unknown>).line1 as string)
									: undefined)
							: undefined,
					addressLine2:
						profile.address && typeof profile.address === "object"
							? ((profile.address as Record<string, unknown>).line2 === null
								? null
								: typeof (profile.address as Record<string, unknown>).line2 ===
									  "string"
									? ((profile.address as Record<string, unknown>).line2 as string)
									: undefined)
							: undefined,
				},
			}),
		);
		return jsonResponse(account);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRegenerateIntendantPassword(context: RouteContext) {
	if (!context.principal.isIntendant || !context.principal.accountId) {
		return validationError(context.request, "Only the intendant can regenerate");
	}
	try {
		const password = await withDb(context.env, (db) =>
			regenerateIntendantPassword(db, context.principal.accountId!),
		);
		return jsonResponse({ password });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
