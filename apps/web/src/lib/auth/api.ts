import { apiUrl } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import type { ProblemDetails } from "@/lib/api/client";
import type { Account, AuthSession, MfaSetup, MfaStatus, SignInResult } from "@/lib/auth/types";

async function parseProblem(response: Response): Promise<ProblemDetails | undefined> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("json")) {
		return undefined;
	}

	try {
		return (await response.json()) as ProblemDetails;
	} catch {
		return undefined;
	}
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(apiUrl(path), {
		credentials: "include",
		...init,
		headers: {
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...init?.headers,
		},
	});

	if (!response.ok) {
		const problem = await parseProblem(response);
		throw new ApiError(
			problem?.detail ?? `Request failed with status ${response.status}`,
			problem,
			response.status,
		);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("json")) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export function bootstrapInstance(): Promise<{
	created: boolean;
	password?: string;
}> {
	return authRequest("/bootstrap", { method: "POST" });
}

export function fetchMe(): Promise<Account> {
	return authRequest<Account>("/auth/me");
}

export function signIn(email: string, password: string): Promise<SignInResult> {
	return authRequest<SignInResult>("/auth/sign-in", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
}

export function verifyMfaSignIn(
	mfaToken: string,
	code: string,
): Promise<{ ok: true }> {
	return authRequest("/auth/mfa/verify", {
		method: "POST",
		body: JSON.stringify({ mfaToken, code }),
	});
}

export function fetchMfaStatus(): Promise<MfaStatus> {
	return authRequest<MfaStatus>("/auth/mfa");
}

export function setupMfa(): Promise<MfaSetup> {
	return authRequest<MfaSetup>("/auth/mfa/setup", { method: "POST" });
}

export function confirmMfa(code: string): Promise<MfaStatus> {
	return authRequest<MfaStatus>("/auth/mfa/confirm", {
		method: "POST",
		body: JSON.stringify({ code }),
	});
}

export function disableMfa(input: {
	password: string;
	code: string;
}): Promise<MfaStatus> {
	return authRequest<MfaStatus>("/auth/mfa", {
		method: "DELETE",
		body: JSON.stringify(input),
	});
}

export function sendMfaDisableRecoveryCode(): Promise<{ ok: true }> {
	return authRequest("/auth/mfa/disable/send-recovery-code", {
		method: "POST",
	});
}

export function sendRecoveryEmailCode(email: string): Promise<{ ok: true }> {
	return authRequest("/auth/recovery-email/send", {
		method: "POST",
		body: JSON.stringify({ email }),
	});
}

export function verifyRecoveryEmail(input: {
	email: string;
	code: string;
}): Promise<{ ok: true }> {
	return authRequest("/auth/recovery-email/verify", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function signOut(): Promise<{ ok: true }> {
	return authRequest("/auth/sign-out", { method: "POST" });
}

export function fetchSessions(): Promise<{ items: AuthSession[] }> {
	return authRequest<{ items: AuthSession[] }>("/auth/sessions");
}

export function revokeSession(
	sessionId: string,
): Promise<{ ok: true; signedOutCurrent: boolean }> {
	return authRequest(`/auth/sessions/${sessionId}`, { method: "DELETE" });
}

export function revokeAllSessions(options?: {
	includeCurrent?: boolean;
}): Promise<{ ok: true; signedOutCurrent: boolean }> {
	const query = options?.includeCurrent ? "?includeCurrent=true" : "";
	return authRequest(`/auth/sessions${query}`, { method: "DELETE" });
}

export function activateAccount(input: {
	code: string;
	password: string;
	profile?: {
		firstName?: string;
		lastName?: string;
		recoveryAddress?: string | null;
		phone?: string | null;
		addressCountry?: string | null;
		addressState?: string | null;
		addressCity?: string | null;
		addressLine1?: string | null;
		addressLine2?: string | null;
		address?: {
			country?: string | null;
			state?: string | null;
			city?: string | null;
			line1?: string | null;
			line2?: string | null;
		};
	};
}): Promise<{ ok: true }> {
	return authRequest("/auth/activate", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function resetPassword(input: {
	code: string;
	password: string;
}): Promise<{ ok: true }> {
	return authRequest("/auth/reset-password", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function requestPasswordReset(address: string): Promise<{ ok: true }> {
	return authRequest("/auth/forgot-password", {
		method: "POST",
		body: JSON.stringify({ address }),
	});
}

export function isUnauthenticatedError(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		(error.status === 400 || error.status === 401)
	);
}
