import { jsonResponse } from "../lib/http/json";

export function handleHealthRequest(): Response {
	return jsonResponse({ ok: true });
}
