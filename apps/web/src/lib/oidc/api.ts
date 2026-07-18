import { apiRequest } from "@/lib/api/request";
import { apiUrl } from "@/lib/api";
import type { ProfilePicture } from "@/lib/profile-picture";

export type OidcClient = {
	id: string;
	clientId: string;
	name: string;
	redirectUris: string[];
	allowedScopes: string[];
	m2mPermissions: string[];
	isConfidential: boolean;
	requireConsent: boolean;
	homescreenUrl: string | null;
	logo: ProfilePicture | null;
	createdAt: string;
	updatedAt: string;
};

export type OidcClientCreated = OidcClient & {
	clientSecret: string | null;
};

export type OidcConsentGrant = {
	id: string;
	clientId: string;
	clientName: string;
	scopes: string[];
	grantedAt: string;
};

export type OidcClientGrant = {
	id: string;
	accountId: string;
	loginIdentifier: string;
	scopes: string[];
	grantedAt: string;
};

export type OidcPending = {
	id: string;
	clientId: string;
	clientRecordId: string;
	clientName: string;
	scopes: string[];
	redirectUri: string;
	requireConsent: boolean;
	homescreenUrl: string | null;
	logo: ProfilePicture | null;
};

export const OIDC_SCOPE_OPTIONS = [
	"openid",
	"profile",
	"email",
	"mail:read",
	"mail:send",
] as const;

export function oidcClientLogoUrl(
	clientRecordId: string,
	logo: ProfilePicture | null | undefined,
	size: "small" | "large" = "small",
): string | null {
	if (!logo?.updatedAt) {
		return null;
	}
	const params = new URLSearchParams({
		size,
		v: logo.updatedAt,
	});
	return apiUrl(`/oidc-clients/${clientRecordId}/logo?${params.toString()}`);
}

export function listOidcClients(): Promise<{ clients: OidcClient[] }> {
	return apiRequest("/oidc-clients");
}

export function createOidcClient(input: {
	name: string;
	redirectUris: string[];
	allowedScopes: string[];
	m2mPermissions: string[];
	isConfidential: boolean;
	requireConsent: boolean;
	homescreenUrl: string | null;
}): Promise<OidcClientCreated> {
	return apiRequest("/oidc-clients", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function updateOidcClient(
	id: string,
	input: Partial<{
		name: string;
		redirectUris: string[];
		allowedScopes: string[];
		m2mPermissions: string[];
		isConfidential: boolean;
		requireConsent: boolean;
		homescreenUrl: string | null;
	}>,
): Promise<OidcClient> {
	return apiRequest(`/oidc-clients/${id}`, {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}

export function deleteOidcClient(id: string): Promise<void> {
	return apiRequest(`/oidc-clients/${id}`, { method: "DELETE" });
}

export async function uploadOidcClientLogo(
	id: string,
	file: File,
): Promise<{ logo: ProfilePicture }> {
	const formData = new FormData();
	formData.set("file", file);
	const response = await fetch(apiUrl(`/oidc-clients/${id}/logo`), {
		method: "PUT",
		credentials: "include",
		body: formData,
	});
	if (!response.ok) {
		const problem = await response.json().catch(() => null);
		throw new Error(
			typeof problem === "object" &&
				problem &&
				"detail" in problem &&
				typeof (problem as { detail: unknown }).detail === "string"
				? (problem as { detail: string }).detail
				: `Upload failed with status ${response.status}`,
		);
	}
	return (await response.json()) as { logo: ProfilePicture };
}

export function deleteOidcClientLogo(
	id: string,
): Promise<{ logo: null }> {
	return apiRequest(`/oidc-clients/${id}/logo`, { method: "DELETE" });
}

export function regenerateOidcClientSecret(
	id: string,
): Promise<{ clientId: string; clientSecret: string }> {
	return apiRequest(`/oidc-clients/${id}/regenerate-secret`, { method: "POST" });
}

export function listOidcClientGrants(
	id: string,
): Promise<{ grants: OidcClientGrant[] }> {
	return apiRequest(`/oidc-clients/${id}/grants`);
}

export function adminRevokeOidcClientGrant(
	id: string,
	accountId: string,
): Promise<void> {
	return apiRequest(`/oidc-clients/${id}/grants/${accountId}`, {
		method: "DELETE",
	});
}

export function listMyOidcGrants(): Promise<{ grants: OidcConsentGrant[] }> {
	return apiRequest("/me/oidc-grants");
}

export function revokeMyOidcGrant(clientId: string): Promise<void> {
	return apiRequest(`/me/oidc-grants/${encodeURIComponent(clientId)}`, {
		method: "DELETE",
	});
}

export function fetchOidcPending(id: string): Promise<OidcPending> {
	return apiRequest(`/oauth/pending/${id}`);
}

export function submitOidcConsent(input: {
	pendingId: string;
	decision: "approve" | "deny";
}): Promise<{ redirectTo: string }> {
	return apiRequest("/oauth/consent", {
		method: "POST",
		body: JSON.stringify(input),
	});
}
