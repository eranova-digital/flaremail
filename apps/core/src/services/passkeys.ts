import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticatorTransportFuture,
	type PublicKeyCredentialDescriptorFuture,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import type { Database } from "../db/client";
import { accountPasskeys, accounts } from "../db/schema";
import type { WebAuthnConfig } from "../lib/auth/webauthn-config";
import { assertChallengeJtiFresh } from "../lib/auth/challenge-jti";
import { verifyPassword } from "../lib/auth/password";
import { loadAccountProfile } from "../lib/auth/principal";
import { createSession, type SessionMetadata } from "./auth-session";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function encodeStoredPublicKey(publicKey: Uint8Array): string {
	return isoBase64URL.fromBuffer(publicKey);
}

function decodeStoredPublicKey(stored: string): Uint8Array {
	return isoBase64URL.toBuffer(stored);
}

export type PasskeySummary = {
	id: string;
	name: string | null;
	createdAt: string;
	lastUsedAt: string | null;
	backedUp: boolean;
};

async function signChallengeToken(
	payload: Record<string, unknown>,
	encryptionKey: string,
): Promise<string> {
	const secret = new TextEncoder().encode(encryptionKey);
	const jti = crypto.randomUUID();
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setJti(jti)
		.setIssuedAt()
		.setExpirationTime(Math.floor((Date.now() + CHALLENGE_TTL_MS) / 1000))
		.sign(secret);
}

async function verifyChallengeToken(
	token: string,
	expectedType: string,
	encryptionKey: string,
): Promise<Record<string, unknown>> {
	const secret = new TextEncoder().encode(encryptionKey);
	const { payload } = await jwtVerify(token, secret);
	if (payload.typ !== expectedType) {
		throw new Error("Invalid passkey challenge");
	}
	if (typeof payload.jti !== "string" || !payload.jti) {
		throw new Error("Invalid passkey challenge");
	}
	await assertChallengeJtiFresh(
		payload.jti,
		Math.ceil(CHALLENGE_TTL_MS / 1000),
	);
	return payload as Record<string, unknown>;
}

function parseTransports(value: string | null): AuthenticatorTransportFuture[] {
	if (!value) {
		return [];
	}
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? (parsed.filter((item) => typeof item === "string") as AuthenticatorTransportFuture[])
			: [];
	} catch {
		return [];
	}
}

function serializeTransports(
	transports: AuthenticatorTransportFuture[] | undefined,
): string | null {
	if (!transports?.length) {
		return null;
	}
	return JSON.stringify(transports);
}

async function listCredentialDescriptors(
	db: Database,
	accountId: string,
): Promise<PublicKeyCredentialDescriptorFuture[]> {
	const rows = await db
		.select({
			credentialId: accountPasskeys.credentialId,
			transports: accountPasskeys.transports,
		})
		.from(accountPasskeys)
		.where(eq(accountPasskeys.accountId, accountId));

	return rows.map((row) => ({
		id: row.credentialId,
		transports: parseTransports(row.transports),
	}));
}

async function resolveActiveAccountByLoginIdentifier(
	db: Database,
	loginIdentifier: string,
) {
	const identifier = loginIdentifier.trim().toLowerCase();
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.loginIdentifier, identifier))
		.limit(1);

	if (!account) {
		throw new Error("Invalid credentials");
	}
	if (account.status === "suspended") {
		throw new Error("Account is suspended");
	}
	if (account.status === "pending") {
		throw new Error("Account is not activated");
	}

	return account;
}

export async function listPasskeys(
	db: Database,
	accountId: string,
): Promise<PasskeySummary[]> {
	const rows = await db
		.select()
		.from(accountPasskeys)
		.where(eq(accountPasskeys.accountId, accountId));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		createdAt: row.createdAt.toISOString(),
		lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
		backedUp: row.backedUp,
	}));
}

export async function beginPasskeyRegistration(
	db: Database,
	input: {
		accountId: string;
		encryptionKey: string;
		config: WebAuthnConfig;
	},
) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, input.accountId))
		.limit(1);
	if (!account) {
		throw new Error("Account not found");
	}

	const profile = await loadAccountProfile(db, input.accountId);
	const displayName =
		profile && `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
			? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
			: account.loginIdentifier;

	const excludeCredentials = await listCredentialDescriptors(db, input.accountId);
	const options = await generateRegistrationOptions({
		rpName: input.config.rpName,
		rpID: input.config.rpID,
		userName: account.loginIdentifier,
		userDisplayName: displayName,
		userID: new TextEncoder().encode(input.accountId),
		attestationType: "none",
		excludeCredentials,
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred",
		},
	});

	const challengeToken = await signChallengeToken(
		{
			typ: "passkey_registration",
			accountId: input.accountId,
			challenge: options.challenge,
		},
		input.encryptionKey,
	);

	return {
		options,
		challengeToken,
	};
}

export async function completePasskeyRegistration(
	db: Database,
	input: {
		accountId: string;
		challengeToken: string;
		response: unknown;
		name?: string;
		encryptionKey: string;
		config: WebAuthnConfig;
	},
) {
	const payload = await verifyChallengeToken(
		input.challengeToken,
		"passkey_registration",
		input.encryptionKey,
	);
	if (payload.accountId !== input.accountId) {
		throw new Error("Invalid passkey challenge");
	}
	if (typeof payload.challenge !== "string") {
		throw new Error("Invalid passkey challenge");
	}

	const verification = await verifyRegistrationResponse({
		response: input.response as Parameters<
			typeof verifyRegistrationResponse
		>[0]["response"],
		expectedChallenge: payload.challenge,
		expectedOrigin: input.config.origin,
		expectedRPID: input.config.rpID,
		requireUserVerification: false,
	});

	if (!verification.verified || !verification.registrationInfo) {
		throw new Error("Passkey registration could not be verified");
	}

	const { credential, credentialBackedUp } = verification.registrationInfo;
	const now = new Date();
	const trimmedName = input.name?.trim() || null;

	await db.insert(accountPasskeys).values({
		id: crypto.randomUUID(),
		accountId: input.accountId,
		credentialId: credential.id,
		publicKey: encodeStoredPublicKey(credential.publicKey),
		signCount: credential.counter,
		name: trimmedName,
		transports: serializeTransports(credential.transports),
		backedUp: credentialBackedUp,
		createdAt: now,
		lastUsedAt: null,
	});

	return listPasskeys(db, input.accountId);
}

export async function beginPasskeySignIn(
	db: Database,
	input: {
		loginIdentifier?: string;
		encryptionKey: string;
		config: WebAuthnConfig;
	},
) {
	let allowCredentials: PublicKeyCredentialDescriptorFuture[] | undefined;
	let accountId: string | undefined;

	if (input.loginIdentifier?.trim()) {
		const account = await resolveActiveAccountByLoginIdentifier(
			db,
			input.loginIdentifier,
		);
		const credentials = await listCredentialDescriptors(db, account.id);
		if (credentials.length === 0) {
			throw new Error("No passkeys are registered for this account");
		}
		allowCredentials = credentials;
		accountId = account.id;
	}

	const options = await generateAuthenticationOptions({
		rpID: input.config.rpID,
		allowCredentials,
		userVerification: "preferred",
	});

	const challengeToken = await signChallengeToken(
		{
			typ: "passkey_sign_in",
			challenge: options.challenge,
			...(accountId ? { accountId } : {}),
		},
		input.encryptionKey,
	);

	return {
		options,
		challengeToken,
	};
}

export async function completePasskeySignIn(
	db: Database,
	input: {
		challengeToken: string;
		response: unknown;
		encryptionKey: string;
		config: WebAuthnConfig;
	},
	sessionMetadata?: SessionMetadata,
) {
	const payload = await verifyChallengeToken(
		input.challengeToken,
		"passkey_sign_in",
		input.encryptionKey,
	);
	if (typeof payload.challenge !== "string") {
		throw new Error("Invalid passkey challenge");
	}

	const authResponse = input.response as {
		id?: string;
		rawId?: string;
	};
	const credentialId = authResponse.id ?? authResponse.rawId;
	if (!credentialId || typeof credentialId !== "string") {
		throw new Error("Invalid passkey response");
	}

	const [stored] = await db
		.select()
		.from(accountPasskeys)
		.where(eq(accountPasskeys.credentialId, credentialId))
		.limit(1);
	if (!stored) {
		throw new Error("Passkey not recognized");
	}

	if (
		typeof payload.accountId === "string" &&
		payload.accountId !== stored.accountId
	) {
		throw new Error("Passkey does not belong to this account");
	}

	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, stored.accountId))
		.limit(1);
	if (!account) {
		throw new Error("Account not found");
	}
	if (account.status === "suspended") {
		throw new Error("Account is suspended");
	}
	if (account.status === "pending") {
		throw new Error("Account is not activated");
	}

	const verification = await verifyAuthenticationResponse({
		response: input.response as Parameters<
			typeof verifyAuthenticationResponse
		>[0]["response"],
		expectedChallenge: payload.challenge,
		expectedOrigin: input.config.origin,
		expectedRPID: input.config.rpID,
		credential: {
			id: stored.credentialId,
			publicKey: decodeStoredPublicKey(stored.publicKey),
			counter: stored.signCount,
			transports: parseTransports(stored.transports),
		},
		requireUserVerification: false,
	});

	if (!verification.verified) {
		throw new Error("Passkey sign-in could not be verified");
	}

	const now = new Date();
	await db
		.update(accountPasskeys)
		.set({
			signCount: verification.authenticationInfo.newCounter,
			lastUsedAt: now,
		})
		.where(eq(accountPasskeys.id, stored.id));

	return createSession(db, stored.accountId, sessionMetadata);
}

export async function removePasskey(
	db: Database,
	input: {
		accountId: string;
		passkeyId: string;
		password: string;
	},
) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, input.accountId))
		.limit(1);
	if (!account?.passwordHash) {
		throw new Error("Account not found");
	}

	const passwordValid = await verifyPassword(input.password, account.passwordHash);
	if (!passwordValid) {
		throw new Error("Invalid password");
	}

	const result = await db
		.delete(accountPasskeys)
		.where(
			and(
				eq(accountPasskeys.id, input.passkeyId),
				eq(accountPasskeys.accountId, input.accountId),
			),
		)
		.returning({ id: accountPasskeys.id });

	if (result.length === 0) {
		throw new Error("Passkey not found");
	}

	return listPasskeys(db, input.accountId);
}
