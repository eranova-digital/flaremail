import { randomBytes, generateKeyPairSync } from "node:crypto";
import { exportJWK } from "jose";

export function generateSessionSecret(): string {
	return randomBytes(32).toString("base64url");
}

export async function generateOidcSigningJwk(): Promise<string> {
	const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
	const jwk = await exportJWK(privateKey);
	jwk.kid = "flaremail";
	jwk.alg = "ES256";
	jwk.use = "sig";
	return JSON.stringify(jwk);
}

export type PostgresOrigin = {
	scheme: "postgres";
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
};

export function parsePostgresUrl(raw: string): PostgresOrigin {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("database.url is not a valid URL");
	}
	if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
		throw new Error("database.url must be a postgres:// or postgresql:// URL");
	}
	const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
	if (!database) {
		throw new Error("database.url is missing a database name");
	}
	if (!url.hostname) {
		throw new Error("database.url is missing a host");
	}
	if (!url.username) {
		throw new Error("database.url is missing a user");
	}
	return {
		scheme: "postgres",
		host: url.hostname,
		port: url.port ? Number(url.port) : 5432,
		database,
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
	};
}
