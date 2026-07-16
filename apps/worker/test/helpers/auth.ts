import { env } from "cloudflare:test";

import { withDb } from "../../src/db/client";
import { accounts, sessions } from "../../src/db/schema";
import { hashSecret } from "../../src/lib/auth/password";

export function authHeaders(token: string): HeadersInit {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
}

export async function createSessionHeaders(): Promise<HeadersInit> {
	const accountId = crypto.randomUUID();
	const sessionId = crypto.randomUUID();
	const token = `session_${crypto.randomUUID()}`;
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
	const absoluteExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	await withDb(env, async (db) => {
		await db.insert(accounts).values({
			id: accountId,
			isIntendant: false,
			role: "user",
			status: "active",
			loginIdentifier: `${accountId}@example.com`,
			passwordHash: null,
			primaryMailboxId: null,
			createdAt: now,
			updatedAt: now,
			activatedAt: now,
			suspendedAt: null,
		});
		await db.insert(sessions).values({
			id: sessionId,
			accountId,
			tokenHash: await hashSecret(token),
			createdAt: now,
			expiresAt,
			lastSeenAt: now,
			absoluteExpiresAt,
			userAgent: "Vitest",
			ipAddress: "127.0.0.1",
			countryCode: "XX",
		});
	});

	return {
		Cookie: `flaremail_session=${token}`,
		"Content-Type": "application/json",
	};
}
