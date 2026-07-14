import { normalizeImageUrl } from "./url";

export async function hashImageUrl(rawUrl: string): Promise<string | null> {
	const normalized = normalizeImageUrl(rawUrl);
	if (!normalized) {
		return null;
	}

	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(normalized),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
