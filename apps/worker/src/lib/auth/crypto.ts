const encoder = new TextEncoder();

export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function randomToken(bytes = 32): string {
	const buffer = new Uint8Array(bytes);
	crypto.getRandomValues(buffer);
	return [...buffer].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomSecret(chars = 32): string {
	const alphabet =
		"ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
	const buffer = new Uint8Array(chars);
	crypto.getRandomValues(buffer);
	return [...buffer].map((byte) => alphabet[byte % alphabet.length]).join("");
}

export function formatCode(): string {
	const part = () =>
		randomSecret(4)
			.toUpperCase()
			.replace(/[^A-Z2-9]/g, "X")
			.slice(0, 4);
	return `${part()}-${part()}`;
}
