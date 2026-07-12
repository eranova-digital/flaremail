import { randomToken, sha256Hex } from "./crypto";

const ITERATIONS = 210_000;

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

export async function hashPassword(password: string): Promise<string> {
	const salt = randomToken(16);
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derived = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt: new TextEncoder().encode(salt),
			iterations: ITERATIONS,
		},
		key,
		256,
	);
	return `pbkdf2$${ITERATIONS}$${salt}$${toBase64(new Uint8Array(derived))}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [scheme, iterationsText, salt, hash] = stored.split("$");
	if (scheme !== "pbkdf2" || !iterationsText || !salt || !hash) {
		return false;
	}

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derived = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt: new TextEncoder().encode(salt),
			iterations: Number(iterationsText),
		},
		key,
		256,
	);
	const actual = toBase64(new Uint8Array(derived));
	return actual === hash;
}

export async function hashSecret(secret: string): Promise<string> {
	return sha256Hex(secret);
}
