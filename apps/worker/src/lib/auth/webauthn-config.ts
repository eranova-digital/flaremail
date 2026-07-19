const RP_NAME = "Flaremail";

export type WebAuthnConfig = {
	rpID: string;
	rpName: string;
	origin: string;
};

function normalizeHostname(hostname: string): string {
	const host = hostname.trim().toLowerCase();
	if (host === "127.0.0.1") {
		return "localhost";
	}
	return host;
}

function parseAllowedOrigins(env: Env): string[] {
	const configured = env.WEB_ORIGIN?.trim();
	if (!configured) {
		return [];
	}
	return configured
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}

/**
 * Derive WebAuthn RP ID / origin from configured WEB_ORIGIN allowlist.
 * Rejects client-supplied Origin values outside that allowlist.
 */
export function resolveWebAuthnConfig(
	request: Request,
	env: Env,
): WebAuthnConfig {
	const allowed = parseAllowedOrigins(env);
	const requestOrigin = request.headers.get("Origin");
	const fallbackOrigin = allowed[0] ?? new URL(request.url).origin;

	let origin = fallbackOrigin;
	if (requestOrigin) {
		if (allowed.length > 0 && !allowed.includes(requestOrigin)) {
			throw new Error("WebAuthn origin is not allowed");
		}
		origin = allowed.length > 0 ? requestOrigin : requestOrigin;
	} else if (allowed.length > 0) {
		origin = allowed[0];
	}

	const originUrl = new URL(origin);
	const rpID = normalizeHostname(originUrl.hostname);

	return {
		rpID,
		rpName: RP_NAME,
		origin,
	};
}
