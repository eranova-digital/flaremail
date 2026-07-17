import { importJWK, jwtVerify, SignJWT, type JWK } from "jose";

type CachedSigningKey = {
	privateKey: CryptoKey | Uint8Array;
	publicJwk: JWK;
	kid: string;
};

let cached: CachedSigningKey | null = null;

export function requireOidcSigningJwk(env: Env): string {
	const value = env.OIDC_SIGNING_JWK;
	if (!value?.trim()) {
		throw new Error("OIDC_SIGNING_JWK is not configured");
	}
	return value;
}

async function loadSigningKey(env: Env): Promise<CachedSigningKey> {
	if (cached) {
		return cached;
	}
	const raw = JSON.parse(requireOidcSigningJwk(env)) as JWK;
	if (raw.kty !== "EC" || raw.crv !== "P-256" || !raw.d) {
		throw new Error("OIDC_SIGNING_JWK must be an EC P-256 private JWK");
	}
	const kid = typeof raw.kid === "string" && raw.kid.length > 0 ? raw.kid : "flaremail";
	const privateKey = await importJWK({ ...raw, alg: "ES256" }, "ES256");
	const { d: _d, ...publicParts } = raw;
	const publicJwk: JWK = {
		...publicParts,
		kid,
		alg: "ES256",
		use: "sig",
	};
	cached = { privateKey, publicJwk, kid };
	return cached;
}

/** Test helper — clear memoized key between cases. */
export function clearOidcSigningKeyCache(): void {
	cached = null;
}

export async function getOidcPublicJwks(env: Env): Promise<{ keys: JWK[] }> {
	const { publicJwk } = await loadSigningKey(env);
	return { keys: [publicJwk] };
}

export async function signOidcJwt(
	env: Env,
	payload: Record<string, unknown>,
	options: { issuer: string; audience: string; expiresIn?: string },
): Promise<string> {
	const { privateKey, kid } = await loadSigningKey(env);
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
		.setIssuer(options.issuer)
		.setAudience(options.audience)
		.setIssuedAt()
		.setExpirationTime(options.expiresIn ?? "1h")
		.sign(privateKey);
}

export async function verifyOidcJwt(env: Env, token: string) {
	const { publicJwk } = await loadSigningKey(env);
	const key = await importJWK(publicJwk, "ES256");
	return jwtVerify(token, key, { algorithms: ["ES256"] });
}
