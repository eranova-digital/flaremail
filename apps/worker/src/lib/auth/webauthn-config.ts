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

export function resolveWebAuthnConfig(request: Request): WebAuthnConfig {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") ?? url.origin;
	const originUrl = new URL(origin);
	const rpID = normalizeHostname(originUrl.hostname);

	return {
		rpID,
		rpName: RP_NAME,
		origin,
	};
}
