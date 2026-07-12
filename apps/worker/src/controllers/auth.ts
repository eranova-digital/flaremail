import { withDb } from "../db/client";
import { parseCookies, SESSION_COOKIE_NAME } from "../lib/auth/cookies";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	activateInvite,
	bootstrapAuth,
	getMe,
	regenerateIntendantPassword,
	resetPasswordWithCode,
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

export async function handleBootstrapAuth(context: RouteContext) {
	return withDb(context.env, async (db) => {
		const result = await bootstrapAuth(db);
		return jsonResponse(result);
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
		const result = await withDb(context.env, (db) =>
			signIn(db, {
				loginIdentifier: value.email as string,
				password: value.password as string,
			}),
		);
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

export async function handleActivateInvite(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.code !== "string" || typeof value.password !== "string") {
		return validationError(context.request, "code and password are required");
	}
	try {
		const result = await withDb(context.env, (db) =>
			activateInvite(db, {
				code: value.code as string,
				password: value.password as string,
				firstName:
					typeof value.firstName === "string" ? value.firstName : undefined,
				lastName: typeof value.lastName === "string" ? value.lastName : undefined,
			}),
		);
		return jsonWithCookie({ ok: true }, result.cookieHeader);
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
