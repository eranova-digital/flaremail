import { apiUrl } from "@/lib/api";
import type { ProblemDetails } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

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

/**
 * Shared HTTP adapter for session-authenticated API calls.
 * Generated OpenAPI client and hand-rolled modules both cross this seam.
 */
export async function apiRequest<T>(
	path: string,
	init?: RequestInit,
): Promise<T> {
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

	if (response.status === 204) {
		return undefined as T;
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("json")) {
		return undefined as T;
	}

	return (await response.json()) as T;
}
