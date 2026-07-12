import { apiRequest } from "@/lib/api/request";
import { ApiError } from "@/lib/api/errors";
import type { Account, AuthSession, MfaSetup, MfaStatus, SignInResult } from "@/lib/auth/types";

export function bootstrapInstance(): Promise<{
	created: boolean;
	password?: string;
}> {
	return apiRequest("/bootstrap", { method: "POST" });
}

export function fetchMe(): Promise<Account> {
	return apiRequest<Account>("/auth/me");
}

export function signIn(email: string, password: string): Promise<SignInResult> {
	return apiRequest<SignInResult>("/auth/sign-in", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
}

export function verifyMfaSignIn(
	mfaToken: string,
	code: string,
): Promise<{ ok: true }> {
	return apiRequest("/auth/mfa/verify", {
		method: "POST",
		body: JSON.stringify({ mfaToken, code }),
	});
}

export function fetchMfaStatus(): Promise<MfaStatus> {
	return apiRequest<MfaStatus>("/auth/mfa");
}

export function setupMfa(): Promise<MfaSetup> {
	return apiRequest<MfaSetup>("/auth/mfa/setup", { method: "POST" });
}

export function confirmMfa(code: string): Promise<MfaStatus> {
	return apiRequest<MfaStatus>("/auth/mfa/confirm", {
		method: "POST",
		body: JSON.stringify({ code }),
	});
}

export function disableMfa(input: {
	password: string;
	code: string;
}): Promise<MfaStatus> {
	return apiRequest<MfaStatus>("/auth/mfa", {
		method: "DELETE",
		body: JSON.stringify(input),
	});
}

export function sendMfaDisableRecoveryCode(): Promise<{ ok: true }> {
	return apiRequest("/auth/mfa/disable/send-recovery-code", {
		method: "POST",
	});
}

export function sendRecoveryEmailCode(email: string): Promise<{ ok: true }> {
	return apiRequest("/auth/recovery-email/send", {
		method: "POST",
		body: JSON.stringify({ email }),
	});
}

export function verifyRecoveryEmail(input: {
	email: string;
	code: string;
}): Promise<{ ok: true }> {
	return apiRequest("/auth/recovery-email/verify", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function signOut(): Promise<{ ok: true }> {
	return apiRequest("/auth/sign-out", { method: "POST" });
}

export function fetchSessions(): Promise<{ items: AuthSession[] }> {
	return apiRequest<{ items: AuthSession[] }>("/auth/sessions");
}

export function revokeSession(
	sessionId: string,
): Promise<{ ok: true; signedOutCurrent: boolean }> {
	return apiRequest(`/auth/sessions/${sessionId}`, { method: "DELETE" });
}

export function revokeAllSessions(options?: {
	includeCurrent?: boolean;
}): Promise<{ ok: true; signedOutCurrent: boolean }> {
	const query = options?.includeCurrent ? "?includeCurrent=true" : "";
	return apiRequest(`/auth/sessions${query}`, { method: "DELETE" });
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
	return apiRequest("/auth/activate", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function resetPassword(input: {
	code: string;
	password: string;
}): Promise<{ ok: true }> {
	return apiRequest("/auth/reset-password", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function requestPasswordReset(address: string): Promise<{ ok: true }> {
	return apiRequest("/auth/forgot-password", {
		method: "POST",
		body: JSON.stringify({ address }),
	});
}

export function fetchPasswordResetPreview(code: string): Promise<{ address: string }> {
	return apiRequest<{ address: string }>(
		`/auth/reset-preview?code=${encodeURIComponent(code.trim())}`,
	);
}

export function isUnauthenticatedError(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		(error.status === 400 || error.status === 401)
	);
}
