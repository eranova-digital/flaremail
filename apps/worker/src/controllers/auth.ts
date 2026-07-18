import { eq } from "drizzle-orm";

import { withDb, type Database } from "../db/client";
import { accounts } from "../db/schema";
import { parseCookies, SESSION_COOKIE_NAME } from "../lib/auth/cookies";
import { extractSessionMetadata } from "../lib/auth/session-metadata";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import { updateAccountProfile } from "../services/accounts";
import {
	activateInvite,
	getMe,
	previewInvite,
	previewPasswordReset,
	regenerateIntendantPassword,
	requestPasswordReset,
	resetPasswordWithCode,
	sessionSecretForEnv,
	signIn,
	signOut,
} from "../services/auth";
import {
	parseLogContextFromRequest,
	safeEmitLog,
} from "../services/logs";

function jsonWithCookie(data: unknown, cookieHeader: string): Response {
	return Response.json(data, {
		status: 200,
		headers: {
			"Cache-Control": "no-store",
			"Set-Cookie": cookieHeader,
		},
	});
}

function accountRef(accountId: string) {
	return { actor: { kind: "account" as const, id: accountId } };
}

async function emitFailedSignIn(
	db: Database,
	request: Request,
	input: { accountId?: string | null; isIntendant?: boolean },
) {
	const accountId = input.accountId ?? null;
	const importance = input.isIntendant ? 0 : 2;
	await safeEmitLog(db, {
		importance,
		type: "auth",
		summary: accountId ? "{actor} failed to sign in" : "Failed sign-in attempt",
		refs: accountId ? accountRef(accountId) : undefined,
		actorAccountId: accountId,
		context: parseLogContextFromRequest(request),
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
	const identifier = value.email.trim().toLowerCase();
	try {
		const sessionMetadata = extractSessionMetadata(context.request);
		const result = await withDb(context.env, async (db) => {
			const signedIn = await signIn(
				db,
				{
					loginIdentifier: value.email as string,
					password: value.password as string,
				},
				sessionSecretForEnv(context.env),
				sessionMetadata,
			);
			if (!signedIn.requiresMfa) {
				await safeEmitLog(db, {
					importance: 4,
					type: "auth",
					summary: "{actor} signed in",
					refs: accountRef(signedIn.accountId),
					actorAccountId: signedIn.accountId,
					context: parseLogContextFromRequest(context.request),
				});
			}
			return signedIn;
		});
		if (result.requiresMfa) {
			return jsonResponse({
				requiresMfa: true,
				mfaToken: result.mfaToken,
			});
		}
		return jsonWithCookie({ ok: true }, result.cookieHeader);
	} catch (error) {
		await withDb(context.env, async (db) => {
			const [account] = await db
				.select({ id: accounts.id, isIntendant: accounts.isIntendant })
				.from(accounts)
				.where(eq(accounts.loginIdentifier, identifier))
				.limit(1);
			await emitFailedSignIn(db, context.request, {
				accountId: account?.id,
				isIntendant: account?.isIntendant ?? identifier === "intendant",
			});
		}).catch((emitError) => {
			console.error("Failed to emit auth log", emitError);
		});
		return handleRouteError(error, context.request);
	}
}

export async function handleSignOut(context: RouteContext) {
	const cookies = parseCookies(context.request.headers.get("Cookie"));
	const token = cookies[SESSION_COOKIE_NAME];
	if (token) {
		const result = await withDb(context.env, async (db) => {
			const signedOut = await signOut(db, token);
			if (signedOut.accountId) {
				await safeEmitLog(db, {
					importance: 6,
					type: "auth",
					summary: "{actor} signed out",
					refs: accountRef(signedOut.accountId),
					actorAccountId: signedOut.accountId,
					context: parseLogContextFromRequest(context.request),
				});
			}
			return signedOut;
		});
		return jsonWithCookie({ ok: true }, result.cookieHeader);
	}
	return jsonResponse({ ok: true });
}

export async function handlePreviewInvite(context: RouteContext) {
	const code = new URL(context.request.url).searchParams.get("code");
	if (!code?.trim()) {
		return validationError(context.request, "code query parameter is required");
	}
	try {
		const preview = await withDb(context.env, (db) =>
			previewInvite(db, code),
		);
		return jsonResponse(preview);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handlePreviewPasswordReset(context: RouteContext) {
	const code = new URL(context.request.url).searchParams.get("code");
	if (!code?.trim()) {
		return validationError(context.request, "code query parameter is required");
	}
	try {
		const preview = await withDb(context.env, (db) =>
			previewPasswordReset(db, code),
		);
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
			activateInvite(
				db,
				{
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
			requestPasswordReset(
				db,
				{
					email: context.env.EMAIL,
					bucket: context.env.BUCKET,
				},
				{
					address: value.address as string,
				},
			),
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
		await withDb(context.env, async (db) => {
			const result = await resetPasswordWithCode(db, {
				code: value.code as string,
				password: value.password as string,
			});
			await safeEmitLog(db, {
				importance: 3,
				type: "auth",
				summary: "{actor} reset their password",
				refs: accountRef(result.accountId),
				actorAccountId: result.accountId,
				context: parseLogContextFromRequest(context.request),
			});
		});
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

	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = (body ?? {}) as Record<string, unknown>;
	const code =
		typeof value.code === "string" ? value.code.trim() : undefined;

	const accountId = context.principal.accountId;
	try {
		const password = await withDb(context.env, async (db) => {
			const nextPassword = await regenerateIntendantPassword(db, {
				accountId,
				code,
				encryptionKey: sessionSecretForEnv(context.env),
			});
			await safeEmitLog(db, {
				importance: 1,
				type: "auth",
				summary: "{actor} regenerated intendant password",
				refs: accountRef(accountId),
				actorAccountId: accountId,
				context: parseLogContextFromRequest(context.request),
			});
			return nextPassword;
		});
		return jsonResponse({ password });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
