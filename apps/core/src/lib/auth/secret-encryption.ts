const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		encoder.encode(`${secret}:totp-secrets`),
	);
	return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
}

export async function encryptSecret(
	plaintext: string,
	encryptionKey: string,
): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await deriveAesKey(encryptionKey);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoder.encode(plaintext),
	);
	return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(
	payload: string,
	encryptionKey: string,
): Promise<string> {
	const [ivText, ciphertextText] = payload.split(".");
	if (!ivText || !ciphertextText) {
		throw new Error("Invalid encrypted secret");
	}

	const key = await deriveAesKey(encryptionKey);
	const plaintext = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: fromBase64(ivText) },
		key,
		fromBase64(ciphertextText),
	);
	return new TextDecoder().decode(plaintext);
}
