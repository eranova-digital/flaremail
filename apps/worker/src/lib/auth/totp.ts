const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

export function generateTotpSecret(length = 20): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let secret = "";
	for (const byte of bytes) {
		secret += BASE32_ALPHABET[byte % BASE32_ALPHABET.length];
	}
	return secret;
}

export function buildOtpAuthUrl(input: {
	secret: string;
	accountName: string;
	issuer?: string;
}): string {
	const issuer = input.issuer ?? "Flaremail";
	const label = encodeURIComponent(`${issuer}:${input.accountName}`);
	const params = new URLSearchParams({
		secret: input.secret,
		issuer,
		algorithm: "SHA1",
		digits: String(TOTP_DIGITS),
		period: String(TOTP_PERIOD_SECONDS),
	});
	return `otpauth://totp/${label}?${params.toString()}`;
}

export async function verifyTotpCode(
	secret: string,
	code: string,
	window = 1,
): Promise<boolean> {
	const normalized = code.replace(/\s/g, "");
	if (!/^\d{6}$/.test(normalized)) {
		return false;
	}

	const key = base32Decode(secret);
	const counter = BigInt(Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS));

	for (let offset = -window; offset <= window; offset += 1) {
		const expected = await generateTotp(key, counter + BigInt(offset));
		if (timingSafeEqual(expected, normalized)) {
			return true;
		}
	}

	return false;
}

/** @internal Test helper */
export async function getCurrentTotpCode(secret: string): Promise<string> {
	const key = base32Decode(secret);
	const counter = BigInt(Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS));
	return generateTotp(key, counter);
}

function base32Decode(input: string): Uint8Array {
	const normalized = input.toUpperCase().replace(/=+$/, "");
	const output: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (const char of normalized) {
		const value = BASE32_ALPHABET.indexOf(char);
		if (value === -1) {
			continue;
		}
		buffer = (buffer << 5) | value;
		bits += 5;
		if (bits >= 8) {
			bits -= 8;
			output.push((buffer >> bits) & 0xff);
		}
	}

	return new Uint8Array(output);
}

async function generateTotp(key: Uint8Array, counter: bigint): Promise<string> {
	const counterBytes = new Uint8Array(8);
	const view = new DataView(counterBytes.buffer);
	view.setBigUint64(0, counter);

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign("HMAC", cryptoKey, counterBytes),
	);
	const offset = signature[signature.length - 1] & 0x0f;
	const binary =
		((signature[offset] & 0x7f) << 24) |
		((signature[offset + 1] & 0xff) << 16) |
		((signature[offset + 2] & 0xff) << 8) |
		(signature[offset + 3] & 0xff);
	const otp = binary % 10 ** TOTP_DIGITS;
	return otp.toString().padStart(TOTP_DIGITS, "0");
}

function timingSafeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) {
		return false;
	}
	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return mismatch === 0;
}
