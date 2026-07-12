export const SESSION_COOKIE_NAME = "flaremail_session";

export function parseCookies(header: string | null): Record<string, string> {
	if (!header) {
		return {};
	}

	return header.split(";").reduce<Record<string, string>>((cookies, part) => {
		const [rawName, ...rest] = part.trim().split("=");
		if (!rawName) {
			return cookies;
		}
		cookies[rawName] = decodeURIComponent(rest.join("="));
		return cookies;
	}, {});
}

export function sessionCookieHeader(
	token: string,
	maxAgeSeconds: number,
): string {
	const parts = [
		`${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${maxAgeSeconds}`,
	];
	return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
	return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
