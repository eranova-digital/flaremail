import { problemResponse, requestInstance } from "./problem";

/** Default max JSON body size for API requests (256 KiB). */
export const MAX_JSON_BODY_BYTES = 256 * 1024;

/** Stricter limit for auth endpoints that are cloned for rate-limit peeks. */
export const MAX_AUTH_JSON_BODY_BYTES = 16 * 1024;

export function contentLengthTooLarge(
	request: Request,
	maxBytes: number,
): Response | null {
	const header = request.headers.get("Content-Length");
	if (!header) {
		return null;
	}
	const length = Number(header);
	if (!Number.isFinite(length) || length < 0) {
		return problemResponse(400, "Invalid Content-Length", {
			code: "invalid-content-length",
			instance: requestInstance(request),
		});
	}
	if (length > maxBytes) {
		return problemResponse(413, "Request body is too large", {
			code: "content-too-large",
			instance: requestInstance(request),
		});
	}
	return null;
}

export async function parseJsonBody<T>(
	request: Request,
	options?: { maxBytes?: number },
): Promise<T | Response> {
	const maxBytes = options?.maxBytes ?? MAX_JSON_BODY_BYTES;
	const tooLarge = contentLengthTooLarge(request, maxBytes);
	if (tooLarge) {
		return tooLarge;
	}

	try {
		const text = await request.text();
		if (new TextEncoder().encode(text).byteLength > maxBytes) {
			return problemResponse(413, "Request body is too large", {
				code: "content-too-large",
				instance: requestInstance(request),
			});
		}
		return JSON.parse(text) as T;
	} catch {
		return problemResponse(400, "Request body must be valid JSON", {
			code: "invalid-json",
			instance: requestInstance(request),
		});
	}
}
