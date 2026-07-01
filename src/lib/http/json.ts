import { problemResponse } from "./problem";

export function jsonResponse(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			"Cache-Control": "no-store",
		},
	});
}

/** @deprecated Use problemResponse directly for clearer call sites. */
export function errorResponse(
	message: string,
	status = 400,
	code?: string,
	instance?: string,
): Response {
	return problemResponse(status, message, {
		code: code?.replace(/_/g, "-").toLowerCase(),
		instance,
	});
}
