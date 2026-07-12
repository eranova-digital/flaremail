import { apiUrl } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import type { ProblemDetails } from "@/lib/api/client";
import type { Account } from "@/lib/auth/types";

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

export function signIn(email: string, password: string): Promise<{ ok: true }> {
	return authRequest("/auth/sign-in", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
}

export function signOut(): Promise<{ ok: true }> {
	return authRequest("/auth/sign-out", { method: "POST" });
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

export function isUnauthenticatedError(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		(error.status === 400 || error.status === 401)
	);
}
