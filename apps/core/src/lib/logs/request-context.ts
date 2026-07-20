import type { LogContext } from "./context";

export function parseLogContextFromRequest(request: Request): LogContext {
	const headers = request.headers;
	const forwarded =
		headers.get("cf-connecting-ip") ??
		headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		null;
	const url = new URL(request.url);
	return {
		ip: forwarded ?? undefined,
		userAgent: headers.get("user-agent") ?? undefined,
		method: request.method,
		path: url.pathname,
	};
}
