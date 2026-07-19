import { withDb } from "../db/client";
import { getOidcPublicJwks } from "../lib/auth/oidc-signing";
import { tryResolveSessionPrincipal } from "../lib/auth/resolve-principal";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { parseLogContextFromRequest } from "../lib/logs/request-context";
import {
	problemResponse,
	requestInstance,
	validationError,
} from "../lib/http/problem";
import { rejectIfAuthFailureLimited } from "../lib/http/rate-limit";
import type { RouteContext } from "../lib/http/router";
import {
	adminRevokeClientGrant,
	decideConsent,
	discoveryDocument,
	exchangeAuthorizationCode,
	exchangeClientCredentials,
	getPendingAuthorizationForAccount,
	getUserInfo,
	issuerUrl,
	listClientGrantsByRecordId,
	listConsentGrantsForAccount,
	OidcError,
	refreshUserToken,
	revokeAccountClientGrant,
	startAuthorization,
	type OidcAuthorizationResult,
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

/** SPA origin for login/consent redirects (may differ from the API/issuer host). */
function webOrigin(request: Request, env: Env): string {
	const configured = env.WEB_ORIGIN?.trim();
	if (configured) {
		return configured.replace(/\/$/, "");
	}
	return new URL(request.url).origin;
}

function logContext(request: Request) {
	return parseLogContextFromRequest(request);
}

async function mapAuthorizationResult(
	result: OidcAuthorizationResult,
): Promise<Response> {
	if (result.kind === "html_error") {
		return htmlErrorPage(result.title, result.message);
	}
	return Response.redirect(result.url, 302);
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

	try {
		return await withDb(context.env, async (db) => {
			const session = await tryResolveSessionPrincipal(
				context.request,
				context.env,
			);
			const result = await startAuthorization(
				db,
				{
					pendingId: url.searchParams.get("pending"),
					clientId: url.searchParams.get("client_id"),
					redirectUri: url.searchParams.get("redirect_uri"),
					state: url.searchParams.get("state"),
					nonce: url.searchParams.get("nonce"),
					codeChallenge: url.searchParams.get("code_challenge"),
					codeChallengeMethod: url.searchParams.get("code_challenge_method"),
					responseType: url.searchParams.get("response_type") ?? "code",
					scope: url.searchParams.get("scope"),
				},
				session,
				webOrigin(context.request, context.env),
				logContext(context.request),
			);
			return mapAuthorizationResult(result);
		});
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleGetOidcPending(context: RouteContext) {
	const pendingId = context.params.id;
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const result = await withDb(context.env, (db) =>
			getPendingAuthorizationForAccount(
				db,
				pendingId,
				context.principal.accountId!,
			),
		);
		if (result === "forbidden") {
			return problemResponse(403, "Forbidden", {
				code: "forbidden",
				instance: requestInstance(context.request),
			});
		}
		if (!result) {
			return problemResponse(404, "Pending authorization not found", {
				code: "not-found",
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
		const result = await withDb(context.env, (db) =>
			decideConsent(
				db,
				{
					pendingId,
					decision,
					accountId: context.principal.accountId!,
				},
				logContext(context.request),
			),
		);
		return jsonResponse({ redirectTo: result.redirectTo });
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
		const limited = await rejectIfAuthFailureLimited(
			context.env,
			context.request,
			params.client_id,
		);
		if (limited) {
			return limited;
		}
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleOidcUserinfo(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const info = await withDb(context.env, (db) =>
			getUserInfo(db, context.principal.accountId!, {
				issuer: issuerUrl(context.request),
				scopes: context.principal.oidcScopes,
			}),
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
			createOidcClientRecord(
				db,
				{
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
					homescreenUrl:
						typeof value.homescreenUrl === "string" || value.homescreenUrl === null
							? (value.homescreenUrl as string | null)
							: undefined,
					createdByAccountId: context.principal.accountId,
				},
				logContext(context.request),
			),
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
				code: "not-found",
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
			updateOidcClient(
				db,
				context.params.id,
				{
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
					homescreenUrl:
						typeof value.homescreenUrl === "string" || value.homescreenUrl === null
							? (value.homescreenUrl as string | null)
							: undefined,
				},
				context.principal.accountId
					? {
							actorAccountId: context.principal.accountId,
							context: logContext(context.request),
						}
					: undefined,
			),
		);
		if (!client) {
			return problemResponse(404, "OIDC client not found", {
				code: "not-found",
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
			deleteOidcClient(
				db,
				context.env.BUCKET,
				context.params.id,
				context.principal.accountId
					? {
							actorAccountId: context.principal.accountId,
							context: logContext(context.request),
						}
					: undefined,
			),
		);
		if (!deleted) {
			return problemResponse(404, "OIDC client not found", {
				code: "not-found",
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
				code: "not-found",
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
		const result = await withDb(context.env, (db) =>
			listClientGrantsByRecordId(db, context.params.id),
		);
		if (!result) {
			return problemResponse(404, "OIDC client not found", {
				code: "not-found",
				instance: requestInstance(context.request),
			});
		}
		return jsonResponse({ grants: result.grants });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

export async function handleAdminRevokeOidcClientGrant(context: RouteContext) {
	try {
		const revoked = await withDb(context.env, (db) =>
			adminRevokeClientGrant(
				db,
				context.params.id,
				context.params.accountId,
				context.principal.accountId
					? {
							actorAccountId: context.principal.accountId,
							context: logContext(context.request),
						}
					: undefined,
			),
		);
		if (revoked === "missing-client") {
			return problemResponse(404, "OIDC client not found", {
				code: "not-found",
				instance: requestInstance(context.request),
			});
		}
		if (revoked === "missing-grant") {
			return problemResponse(404, "Consent grant not found", {
				code: "not-found",
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
	const accountId = context.principal.accountId;
	try {
		const revoked = await withDb(context.env, (db) =>
			revokeAccountClientGrant(db, accountId, context.params.clientId, {
				actorAccountId: accountId,
				context: logContext(context.request),
			}),
		);
		if (!revoked) {
			return problemResponse(404, "Consent grant not found", {
				code: "not-found",
				instance: requestInstance(context.request),
			});
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		return oidcErrorResponse(error, context.request);
	}
}

async function readOidcClientLogoUpload(context: RouteContext) {
	const contentType = context.request.headers.get("Content-Type") ?? "";
	if (!contentType.toLowerCase().includes("multipart/form-data")) {
		return validationError(context.request, "Expected multipart form data");
	}
	let formData: FormData;
	try {
		formData = await context.request.formData();
	} catch {
		return validationError(context.request, "Invalid form data");
	}
	const file = formData.get("file");
	if (!(file instanceof File) || file.size === 0) {
		return validationError(context.request, "file is required");
	}
	return file;
}

export async function handleUploadOidcClientLogo(context: RouteContext) {
	const file = await readOidcClientLogoUpload(context);
	if (file instanceof Response) {
		return file;
	}
	try {
		const { uploadOidcClientLogo } = await import("../services/oidc-client-logo");
		const result = await withDb(context.env, (db) =>
			uploadOidcClientLogo(db, context.env.BUCKET, context.params.id, file),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleDeleteOidcClientLogo(context: RouteContext) {
	try {
		const { removeOidcClientLogo } = await import("../services/oidc-client-logo");
		const result = await withDb(context.env, (db) =>
			removeOidcClientLogo(db, context.env.BUCKET, context.params.id),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetOidcClientLogo(context: RouteContext) {
	const url = new URL(context.request.url);
	const size = url.searchParams.get("size");
	try {
		const { downloadOidcClientLogo } = await import("../services/oidc-client-logo");
		return await withDb(context.env, (db) =>
			downloadOidcClientLogo(db, context.env.BUCKET, context.params.id, size),
		);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
