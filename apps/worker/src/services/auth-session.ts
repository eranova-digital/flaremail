import { and, desc, eq, gt, ne } from "drizzle-orm";

import type { Database } from "../db/client";
import { sessions } from "../db/schema";
import { randomToken } from "../lib/auth/crypto";
import {
	clearSessionCookieHeader,
	sessionCookieHeader,
} from "../lib/auth/cookies";
import { hashSecret } from "../lib/auth/password";
import {
	parseUserAgent,
	type SessionMetadata,
} from "../lib/auth/session-metadata";

const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_SEEN_UPDATE_MS = 5 * 60 * 1000;

export type { SessionMetadata };

export async function createSession(
	db: Database,
	accountId: string,
	metadata?: SessionMetadata,
) {
	const token = randomToken(32);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
	const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
	await db.insert(sessions).values({
		id: crypto.randomUUID(),
		accountId,
		tokenHash: await hashSecret(token),
		createdAt: now,
		expiresAt,
		lastSeenAt: now,
		absoluteExpiresAt,
		userAgent: metadata?.userAgent ?? null,
		ipAddress: metadata?.ipAddress ?? null,
		countryCode: metadata?.countryCode ?? null,
	});
	return {
		token,
		cookieHeader: sessionCookieHeader(token, Math.floor(SESSION_IDLE_MS / 1000)),
	};
}

export async function signOutSession(db: Database, sessionToken: string) {
	const tokenHash = await hashSecret(sessionToken);
	await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
	return clearSessionCookieHeader();
}

export async function touchSession(db: Database, sessionId: string, lastSeenAt: Date) {
	const now = new Date();
	if (now.getTime() - lastSeenAt.getTime() < LAST_SEEN_UPDATE_MS) {
		return;
	}
	await db
		.update(sessions)
		.set({ lastSeenAt: now })
		.where(eq(sessions.id, sessionId));
}

function activeSessionConditions(now: Date) {
	return and(gt(sessions.expiresAt, now), gt(sessions.absoluteExpiresAt, now));
}

export async function listActiveSessions(
	db: Database,
	accountId: string,
	currentSessionId?: string,
) {
	const now = new Date();
	const rows = await db
		.select()
		.from(sessions)
		.where(and(eq(sessions.accountId, accountId), activeSessionConditions(now)))
		.orderBy(desc(sessions.lastSeenAt));

	return rows.map((row) => {
		const { browser, os } = parseUserAgent(row.userAgent);
		return {
			id: row.id,
			current: currentSessionId === row.id,
			createdAt: row.createdAt.toISOString(),
			lastSeenAt: row.lastSeenAt.toISOString(),
			expiresAt: row.expiresAt.toISOString(),
			ipAddress: row.ipAddress,
			countryCode: row.countryCode,
			browser,
			os,
		};
	});
}

export async function revokeSession(
	db: Database,
	accountId: string,
	sessionId: string,
	currentSessionId?: string,
) {
	const now = new Date();
	const [row] = await db
		.select({ id: sessions.id })
		.from(sessions)
		.where(
			and(
				eq(sessions.id, sessionId),
				eq(sessions.accountId, accountId),
				activeSessionConditions(now),
			),
		)
		.limit(1);

	if (!row) {
		throw new Error("Session not found");
	}

	await db.delete(sessions).where(eq(sessions.id, sessionId));

	return {
		signedOutCurrent: currentSessionId === sessionId,
		cookieHeader:
			currentSessionId === sessionId ? clearSessionCookieHeader() : null,
	};
}

export async function revokeAllSessions(
	db: Database,
	accountId: string,
	options: { includeCurrent?: boolean; currentSessionId?: string } = {},
) {
	const now = new Date();
	const includeCurrent = options.includeCurrent ?? false;
	const currentSessionId = options.currentSessionId;

	const conditions = [eq(sessions.accountId, accountId), activeSessionConditions(now)];
	if (!includeCurrent && currentSessionId) {
		conditions.push(ne(sessions.id, currentSessionId));
	}

	await db.delete(sessions).where(and(...conditions));

	const signedOutCurrent = includeCurrent && Boolean(currentSessionId);

	return {
		signedOutCurrent,
		cookieHeader: signedOutCurrent ? clearSessionCookieHeader() : null,
	};
}
