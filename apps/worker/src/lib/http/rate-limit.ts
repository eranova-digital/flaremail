import { PROBLEM_CONTENT_TYPE, buildProblemDetails, requestInstance } from "./problem";
import {
	MAX_AUTH_JSON_BODY_BYTES,
	contentLengthTooLarge,
} from "./parse-body";

export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

export type AuthRateLimitConfig = {
	/** JSON/form body fields to include in the auth key (first non-empty wins). */
	keyFields?: readonly string[];
};

export function clientIpFromRequest(request: Request): string {
	const headers = request.headers;
	return (
		headers.get("cf-connecting-ip") ??
		headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown"
	);
}

export function normalizeRateLimitIdentifier(value: string): string {
	return value.trim().toLowerCase();
}

export function buildRateLimitKey(
	ip: string,
	identifier?: string | null,
): string {
	const normalized = identifier?.trim()
		? normalizeRateLimitIdentifier(identifier)
		: null;
	return normalized ? `${ip}:${normalized}` : ip;
}

export function rateLimitExceededResponse(request: Request): Response {
	const body = buildProblemDetails(429, "Rate limit exceeded", {
		code: "rate-limit-exceeded",
		instance: requestInstance(request),
	});

	return Response.json(body, {
		status: 429,
		headers: {
			"Content-Type": PROBLEM_CONTENT_TYPE,
			"Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS),
		},
	});
}

export async function consumeRateLimit(
	limiter: RateLimit,
	key: string,
	request: Request,
): Promise<Response | null> {
	const { success } = await limiter.limit({ key });
	if (!success) {
		return rateLimitExceededResponse(request);
	}
	return null;
}

export async function enforceGlobalRateLimit(
	env: Env,
	request: Request,
	accountId?: string | null,
): Promise<Response | null> {
	const ip = clientIpFromRequest(request);
	const key = accountId?.trim() ? `account:${accountId}` : `ip:${ip}`;
	return consumeRateLimit(env.RATE_LIMIT_GLOBAL, key, request);
}

/**
 * Peek auth identifier fields without consuming the request body.
 * Supports JSON and form-urlencoded bodies; also reads OAuth Basic client_id.
 */
export async function peekAuthRateLimitIdentifier(
	request: Request,
	keyFields: readonly string[] = [],
): Promise<string | null> {
	if (keyFields.length === 0) {
		return peekBasicAuthClientId(request);
	}

	const url = new URL(request.url);
	for (const field of keyFields) {
		const queryValue = url.searchParams.get(field);
		if (queryValue?.trim()) {
			return normalizeRateLimitIdentifier(queryValue);
		}
	}

	const clone = request.clone();
	const params = await readBodyParams(clone);
	for (const field of keyFields) {
		const value = params[field];
		if (typeof value === "string" && value.trim()) {
			return normalizeRateLimitIdentifier(value);
		}
	}

	if (keyFields.includes("client_id")) {
		return peekBasicAuthClientId(request);
	}

	return null;
}

export async function enforceAuthPreRateLimit(
	env: Env,
	request: Request,
	config: AuthRateLimitConfig,
): Promise<Response | null> {
	const tooLarge = contentLengthTooLarge(request, MAX_AUTH_JSON_BODY_BYTES);
	if (tooLarge) {
		return tooLarge;
	}
	const ip = clientIpFromRequest(request);
	const identifier = await peekAuthRateLimitIdentifier(
		request,
		config.keyFields ?? [],
	);
	const key = buildRateLimitKey(ip, identifier);
	return consumeRateLimit(env.RATE_LIMIT_AUTH, key, request);
}

/**
 * Burn a failure token after an unsuccessful auth/code outcome.
 * Returns a 429 response when the failure budget is exhausted.
 */
export async function rejectIfAuthFailureLimited(
	env: Env,
	request: Request,
	identifier?: string | null,
): Promise<Response | null> {
	const ip = clientIpFromRequest(request);
	const key = buildRateLimitKey(ip, identifier);
	return consumeRateLimit(env.RATE_LIMIT_AUTH_FAILURE, key, request);
}

function peekBasicAuthClientId(request: Request): string | null {
	const basic = request.headers.get("Authorization");
	if (!basic?.startsWith("Basic ")) {
		return null;
	}
	try {
		const decoded = atob(basic.slice("Basic ".length));
		const clientId = decoded.split(":", 2)[0];
		return clientId?.trim()
			? normalizeRateLimitIdentifier(clientId)
			: null;
	} catch {
		return null;
	}
}

async function readBodyParams(
	request: Request,
): Promise<Record<string, unknown>> {
	const contentType = request.headers.get("Content-Type") ?? "";
	try {
		if (contentType.includes("application/json")) {
			const json = (await request.json()) as unknown;
			return json && typeof json === "object"
				? (json as Record<string, unknown>)
				: {};
		}

		const text = await request.text();
		if (!text.trim()) {
			return {};
		}

		if (
			contentType.includes("application/x-www-form-urlencoded") ||
			contentType.includes("multipart/form-data")
		) {
			return Object.fromEntries(new URLSearchParams(text));
		}

		try {
			const json = JSON.parse(text) as unknown;
			return json && typeof json === "object"
				? (json as Record<string, unknown>)
				: {};
		} catch {
			return Object.fromEntries(new URLSearchParams(text));
		}
	} catch {
		return {};
	}
}
