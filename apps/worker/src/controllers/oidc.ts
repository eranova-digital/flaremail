import { withDb, type Database } from "../db/client";
import type { OidcClient } from "../db/schema";
import type { Principal } from "../lib/auth/types";
import { getOidcPublicJwks } from "../lib/auth/oidc-signing";
import { tryResolveSessionPrincipal } from "../lib/auth/resolve-principal";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import {
	problemResponse,
	requestInstance,
	validationError,
} from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	bindPendingAuthorizationAccount,
	buildClientRedirect,
	completeAuthorization,
	createPendingAuthorization,
	denyAuthorization,
	discoveryDocument,
	exchangeAuthorizationCode,
	exchangeClientCredentials,
	getOidcClientByClientId,
	getPendingAuthorization,
	getUserInfo,
	intersectScopes,
	isExactRedirectUri,
	listConsentGrantsForAccount,
	listConsentGrantsForClient,
	needsConsent,
	OidcError,
	parseScopeList,
	refreshUserToken,
	revokeConsentGrant,
	upsertConsentGrant,
	type OidcPendingAuthorization,
} from "../services/oidc";
import {
	createOidcClientRecord,
	deleteOidcClient,
	getOidcClientById,
	listOidcClients,
	regenerateOidcClientSecret,
	updateOidcClient,
} from "../services/oidc-clients";

function oidcErrorResponse(error: unknown, request: Request): Response {
	if (error instanceof OidcError) {
		return problemResponse(error.status, error.message, {
			code: error.code,
			instance: requestInstance(request),
		});
	}
	return handleRouteError(error, request);
}

function htmlErrorPage(title: string, message: string): Response {
	const body = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${message}</p></body></html>`;
	return new Response(body, {
		status: 400,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

function webOrigin(request: Request): string {
	return new URL(request.url).origin;
}

export async function handleOpenIdDiscovery(context: RouteContext): Promise<Response> {
	return jsonResponse(discoveryDocument(context.request));
}

export async function handleOidcJwks(context: RouteContext): Promise<Response> {
	try {
		return jsonResponse(await getOidcPublicJwks(context.env));
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleOidcAuthorize(context: RouteContext) {
	const url = new URL(context.request.url);
	const pendingId = url.searchParams.get("pending");

	try {
		return await withDb(context.env, async (db) => {
			const session = await tryResolveSessionPrincipal(
				context.request,
				context.env,
			);

			if (pendingId) {
				const pending = await getPendingAuthorization(db, pendingId);
				if (!pending) {
					return htmlErrorPage(
						"Invalid request",
						"This authorization request has expired.",
					);
				}
				const client = await getOidcClientByClientId(db, pending.clientId);
				if (!client) {
					return htmlErrorPage("Invalid client", "The OIDC client no longer exists.");
				}
				return continuePendingAuthorization(
					context.request,
					db,
					pending,
					client,
					session,
				);
			}

			const clientId = url.searchParams.get("client_id");
			const redirectUri = url.searchParams.get("redirect_uri");
			const state = url.searchParams.get("state");
			const nonce = url.searchParams.get("nonce");
			const codeChallenge = url.searchParams.get("code_challenge");
			const codeChallengeMethod = url.searchParams.get("code_challenge_method");
			const responseType = url.searchParams.get("response_type") ?? "code";

			if (!clientId || !redirectUri) {
				return htmlErrorPage(
					"Invalid request",
					"client_id and redirect_uri are required.",
				);
			}

			const client = await getOidcClientByClientId(db, clientId);
			if (!client || !isExactRedirectUri(client, redirectUri)) {
				return htmlErrorPage(
					"Invalid client",
					"Unknown client_id or redirect_uri is not registered.",
				);
			}

			if (responseType !== "code") {
				return Response.redirect(
					buildClientRedirect(redirectUri, {
						error: "unsupported_response_type",
						state: state ?? undefined,
					}),
					302,
				);
			}
			if (!codeChallenge || codeChallengeMethod !== "S256") {
				return Response.redirect(
					buildClientRedirect(redirectUri, {
						error: "invalid_request",
						error_description: "PKCE with S256 is required",
						state: state ?? undefined,
					}),
					302,
				);
			}

			const requested = parseScopeList(url.searchParams.get("scope"));
			const scopes = intersectScopes(requested, client.allowedScopes);
			if (!scopes.includes("openid")) {
				return Response.redirect(
					buildClientRedirect(redirectUri, {
						error: "invalid_scope",
						error_description: "openid scope is required",
						state: state ?? undefined,
					}),
					302,
				);
			}

			const pending = await createPendingAuthorization(db, {
				clientId: client.clientId,
				redirectUri,
				scopes,
				state,
				nonce,
				codeChallenge,
				codeChallengeMethod,
			});

			return continuePendingAuthorization(
				context.request,
				db,
				pending,
				client,
				session,
			);
		});
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

async function continuePendingAuthorization(
	request: Request,
	db: Database,
	pending: OidcPendingAuthorization,
	client: OidcClient,
	session: Principal | null,
): Promise<Response> {
	if (!session?.accountId) {
		const resume = `/api/v1/oauth/authorize?pending=${encodeURIComponent(pending.id)}`;
		const login = new URL("/login", webOrigin(request));
		login.searchParams.set("return_to", resume);
		return Response.redirect(login.toString(), 302);
	}

	if (session.isIntendant) {
		await denyAuthorization(db, pending);
		return Response.redirect(
			buildClientRedirect(pending.redirectUri, {
				error: "access_denied",
				error_description: "Intendant cannot use OIDC",
				state: pending.state ?? undefined,
			}),
			302,
		);
	}

	if (session.status !== "active") {
		return Response.redirect(
			buildClientRedirect(pending.redirectUri, {
				error: "access_denied",
				error_description: "Account is not active",
				state: pending.state ?? undefined,
			}),
			302,
		);
	}

	let activePending = pending;
	if (pending.accountId && pending.accountId !== session.accountId) {
		return htmlErrorPage(
			"Session mismatch",
			"This authorization request belongs to a different account.",
		);
	}
	if (!pending.accountId) {
		await bindPendingAuthorizationAccount(db, pending.id, session.accountId);
		activePending = { ...pending, accountId: session.accountId };
	}

	if (await needsConsent(db, client, session.accountId, activePending.scopes)) {
		const consent = new URL("/oauth/consent", webOrigin(request));
		consent.searchParams.set("pending", activePending.id);
		return Response.redirect(consent.toString(), 302);
	}

	const location = await completeAuthorization(db, activePending, session.accountId);
	return Response.redirect(location, 302);
}

export async function handleGetOidcPending(context: RouteContext) {
	const pendingId = context.params.id;
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const result = await withDb(context.env, async (db) => {
			const pending = await getPendingAuthorization(db, pendingId);
			if (!pending) {
				return null;
			}
			if (pending.accountId && pending.accountId !== context.principal.accountId) {
				return "forbidden" as const;
			}
			const client = await getOidcClientByClientId(db, pending.clientId);
			if (!client) {
				return null;
			}
			return {
				id: pending.id,
				clientId: client.clientId,
				clientName: client.name,
				scopes: pending.scopes,
				redirectUri: pending.redirectUri,
				requireConsent: client.requireConsent,
			};
		});
		if (result === "forbidden") {
			return problemResponse(403, "Forbidden", {
				code: "forbidden",
				instance: requestInstance(context.request),
			});
		}
		if (!result) {
			return problemResponse(404, "Pending authorization not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		return jsonResponse(result);
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleOidcConsentDecision(context: RouteContext) {
	if (!context.principal.accountId || context.principal.isIntendant) {
		return validationError(context.request, "Eligible account required");
	}
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	const pendingId = typeof value.pendingId === "string" ? value.pendingId : null;
	const decision =
		value.decision === "deny"
			? "deny"
			: value.decision === "approve"
				? "approve"
				: null;
	if (!pendingId || !decision) {
		return validationError(context.request, "pendingId and decision are required");
	}

	try {
		const location = await withDb(context.env, async (db) => {
			const pending = await getPendingAuthorization(db, pendingId);
			if (!pending) {
				throw new OidcError(
					"Pending authorization not found",
					"invalid_request",
					404,
				);
			}
			if (pending.accountId && pending.accountId !== context.principal.accountId) {
				throw new OidcError("Session mismatch", "access_denied", 403);
			}
			const accountId = context.principal.accountId!;
			if (!pending.accountId) {
				await bindPendingAuthorizationAccount(db, pending.id, accountId);
			}
			if (decision === "deny") {
				return denyAuthorization(db, { ...pending, accountId });
			}
			const client = await getOidcClientByClientId(db, pending.clientId);
			if (!client) {
				throw new OidcError("Invalid client", "invalid_client", 400);
			}
			await upsertConsentGrant(db, {
				accountId,
				clientId: client.clientId,
				scopes: pending.scopes,
			});
			return completeAuthorization(db, pending, accountId);
		});
		return jsonResponse({ redirectTo: location });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleOidcToken(context: RouteContext) {
	const contentType = context.request.headers.get("Content-Type") ?? "";
	let params: Record<string, string>;
	if (contentType.includes("application/json")) {
		params = (await context.request.json()) as Record<string, string>;
	} else {
		params = Object.fromEntries(new URLSearchParams(await context.request.text()));
	}

	const basic = context.request.headers.get("Authorization");
	if (basic?.startsWith("Basic ")) {
		try {
			const decoded = atob(basic.slice("Basic ".length));
			const [clientId, clientSecret] = decoded.split(":", 2);
			if (clientId && !params.client_id) {
				params.client_id = clientId;
			}
			if (clientSecret && !params.client_secret) {
				params.client_secret = clientSecret;
			}
		} catch {
			/* ignore malformed basic auth */
		}
	}

	const grantType = params.grant_type;
	try {
		if (grantType === "authorization_code") {
			const tokens = await withDb(context.env, (db) =>
				exchangeAuthorizationCode(db, context.env, context.request, {
					code: params.code,
					clientId: params.client_id,
					redirectUri: params.redirect_uri,
					codeVerifier: params.code_verifier,
					clientSecret: params.client_secret,
				}),
			);
			return jsonResponse(tokens);
		}
		if (grantType === "refresh_token") {
			const tokens = await withDb(context.env, (db) =>
				refreshUserToken(db, context.env, context.request, {
					refreshToken: params.refresh_token,
					clientId: params.client_id,
					clientSecret: params.client_secret,
				}),
			);
			return jsonResponse(tokens);
		}
		if (grantType === "client_credentials") {
			const tokens = await withDb(context.env, (db) =>
				exchangeClientCredentials(db, context.env, context.request, {
					clientId: params.client_id,
					clientSecret: params.client_secret,
					scope: params.scope,
				}),
			);
			return jsonResponse(tokens);
		}
		return validationError(context.request, "Unsupported grant_type");
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleOidcUserinfo(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const info = await withDb(context.env, (db) =>
			getUserInfo(db, context.principal.accountId!),
		);
		return jsonResponse(info);
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleCreateOidcClient(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.name !== "string" || !Array.isArray(value.redirectUris)) {
		return validationError(context.request, "name and redirectUris are required");
	}
	try {
		const result = await withDb(context.env, (db) =>
			createOidcClientRecord(db, {
				name: value.name as string,
				redirectUris: (value.redirectUris as unknown[]).filter(
					(uri): uri is string => typeof uri === "string",
				),
				allowedScopes: Array.isArray(value.allowedScopes)
					? value.allowedScopes.filter((s): s is string => typeof s === "string")
					: ["openid", "profile", "email"],
				m2mPermissions: Array.isArray(value.m2mPermissions)
					? value.m2mPermissions.filter((s): s is string => typeof s === "string")
					: [],
				isConfidential: value.isConfidential !== false,
				requireConsent: value.requireConsent !== false,
				createdByAccountId: context.principal.accountId,
			}),
		);
		return jsonResponse(result, 201);
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleListOidcClients(context: RouteContext) {
	try {
		const clients = await withDb(context.env, (db) => listOidcClients(db));
		return jsonResponse({ clients });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleGetOidcClient(context: RouteContext) {
	try {
		const client = await withDb(context.env, (db) =>
			getOidcClientById(db, context.params.id),
		);
		if (!client) {
			return problemResponse(404, "OIDC client not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		return jsonResponse(client);
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleUpdateOidcClient(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	try {
		const client = await withDb(context.env, (db) =>
			updateOidcClient(db, context.params.id, {
				name: typeof value.name === "string" ? value.name : undefined,
				redirectUris: Array.isArray(value.redirectUris)
					? value.redirectUris.filter((s): s is string => typeof s === "string")
					: undefined,
				allowedScopes: Array.isArray(value.allowedScopes)
					? value.allowedScopes.filter((s): s is string => typeof s === "string")
					: undefined,
				m2mPermissions: Array.isArray(value.m2mPermissions)
					? value.m2mPermissions.filter((s): s is string => typeof s === "string")
					: undefined,
				isConfidential:
					typeof value.isConfidential === "boolean"
						? value.isConfidential
						: undefined,
				requireConsent:
					typeof value.requireConsent === "boolean"
						? value.requireConsent
						: undefined,
			}),
		);
		if (!client) {
			return problemResponse(404, "OIDC client not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		return jsonResponse(client);
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleDeleteOidcClient(context: RouteContext) {
	try {
		const deleted = await withDb(context.env, (db) =>
			deleteOidcClient(db, context.params.id),
		);
		if (!deleted) {
			return problemResponse(404, "OIDC client not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleRegenerateOidcClientSecret(context: RouteContext) {
	try {
		const result = await withDb(context.env, (db) =>
			regenerateOidcClientSecret(db, context.params.id),
		);
		if (!result) {
			return problemResponse(404, "OIDC client not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		return jsonResponse(result);
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleListOidcClientGrants(context: RouteContext) {
	try {
		const client = await withDb(context.env, (db) =>
			getOidcClientById(db, context.params.id),
		);
		if (!client) {
			return problemResponse(404, "OIDC client not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		const grants = await withDb(context.env, (db) =>
			listConsentGrantsForClient(db, client.clientId),
		);
		return jsonResponse({ grants });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleAdminRevokeOidcClientGrant(context: RouteContext) {
	try {
		const client = await withDb(context.env, (db) =>
			getOidcClientById(db, context.params.id),
		);
		if (!client) {
			return problemResponse(404, "OIDC client not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		const revoked = await withDb(context.env, (db) =>
			revokeConsentGrant(db, context.params.accountId, client.clientId),
		);
		if (!revoked) {
			return problemResponse(404, "Consent grant not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleListMyOidcGrants(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const grants = await withDb(context.env, (db) =>
			listConsentGrantsForAccount(db, context.principal.accountId!),
		);
		return jsonResponse({ grants });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleRevokeMyOidcGrant(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const revoked = await withDb(context.env, (db) =>
			revokeConsentGrant(
				db,
				context.principal.accountId!,
				context.params.clientId,
			),
		);
		if (!revoked) {
			return problemResponse(404, "Consent grant not found", {
				code: "not_found",
				instance: requestInstance(context.request),
			});
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}
