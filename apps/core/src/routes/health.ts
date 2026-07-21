import { jsonResponse } from "../lib/http/json";
import { APP_VERSION } from "../lib/app-version";

export function handleHealthRequest(): Response {
	return jsonResponse({ ok: true, version: APP_VERSION });
}
