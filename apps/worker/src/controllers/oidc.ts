import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	createAuthorizationCode,
	createOidcClient,
	discoveryDocument,
	exchangeAuthorizationCode,
	exchangeClientCredentials,
	getUserInfo,
	issuerUrl,
	refreshUserToken,
} from "../services/oidc";
import { requireSessionSecret } from "../lib/auth/resolve-principal";

export async function handleOpenIdDiscovery(context: RouteContext): Promise<Response> {
	return jsonResponse(discoveryDocument(context.request));
}

export async function handleOidcJwks(context: RouteContext): Promise<Response> {
	const secret = requireSessionSecret(context.env);
	return jsonResponse({
		keys: [
			{
				kty: "oct",
				kid: "flaremail-hs256",
				alg: "HS256",
				k: btoa(String.fromCharCode(...new TextEncoder().encode(secret))),
			},
		],
	});
}

export async function handleOidcAuthorize(context: RouteContext) {
	const url = new URL(context.request.url);
	const clientId = url.searchParams.get("client_id");
	const redirectUri = url.searchParams.get("redirect_uri");
	const scope = url.searchParams.get("scope") ?? "openid profile email";
	const state = url.searchParams.get("state") ?? "";
	const codeChallenge = url.searchParams.get("code_challenge");
	const codeChallengeMethod = url.searchParams.get("code_challenge_method");

	if (!clientId || !redirectUri) {
		return validationError(context.request, "client_id and redirect_uri are required");
	}
	if (!context.principal.accountId || context.principal.status !== "active") {
		return validationError(context.request, "Active account required");
	}
	if (context.principal.isIntendant) {
		return validationError(context.request, "Intendant cannot use OIDC");
	}

	try {
		const code = await withDb(context.env, (db) =>
			createAuthorizationCode(db, {
				clientId,
				accountId: context.principal.accountId!,
				redirectUri,
				scopes: scope.split(" ").filter(Boolean),
				codeChallenge: codeChallenge ?? undefined,
				codeChallengeMethod: codeChallengeMethod ?? undefined,
			}),
		);
		const target = new URL(redirectUri);
		target.searchParams.set("code", code);
		if (state) {
			target.searchParams.set("state", state);
		}
		return Response.redirect(target.toString(), 302);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleOidcToken(context: RouteContext) {
	const contentType = context.request.headers.get("Content-Type") ?? "";
	const params = contentType.includes("application/json")
		? ((await context.request.json()) as Record<string, string>)
		: Object.fromEntries(new URLSearchParams(await context.request.text()));

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
		return handleRouteError(error, context.request);
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
		return handleRouteError(error, context.request);
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
			createOidcClient(db, {
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
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
