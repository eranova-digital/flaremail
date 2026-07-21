import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { accountProfiles, accounts } from "../db/schema";
import { randomSecret } from "../lib/auth/crypto";
import { hashPassword } from "../lib/auth/password";

const INTENDANT_LOGIN = "intendant";

/** Called only from POST /api/v1/bootstrap. */
export async function ensureIntendantBootstrapped(
	db: Database,
): Promise<{ created: boolean; password?: string }> {
	const [existing] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(eq(accounts.isIntendant, true))
		.limit(1);

	if (existing) {
		return { created: false };
	}

	const password = randomSecret(32);
	const accountId = crypto.randomUUID();
	const now = new Date();

	await db.insert(accounts).values({
		id: accountId,
		isIntendant: true,
		role: null,
		status: "active",
		loginIdentifier: INTENDANT_LOGIN,
		passwordHash: await hashPassword(password),
		primaryMailboxId: null,
		createdAt: now,
		updatedAt: now,
		activatedAt: now,
	});

	await db.insert(accountProfiles).values({
		accountId,
		firstName: "Intendant",
		lastName: "Account",
		updatedAt: now,
	});

	return { created: true, password };
}

export function isIntendantLogin(identifier: string): boolean {
	return identifier.trim().toLowerCase() === INTENDANT_LOGIN;
}
