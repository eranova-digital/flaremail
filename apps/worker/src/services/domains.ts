import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { domains } from "../db/schema";
import { normalizeEmailAddress } from "../lib/normalize-email-address";
import { deleteDomainCascade } from "./cascade-delete";
import { toDomainDto } from "./dto";

export async function listDomains(db: Database) {
	const rows = await db.select().from(domains).orderBy(domains.name);
	return rows.map(toDomainDto);
}

export async function getDomain(db: Database, id: string) {
	const [row] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
	if (!row) {
		throw new Error("Domain not found");
	}

	return toDomainDto(row);
}

export async function createDomain(db: Database, name: string) {
	const normalized = normalizeEmailAddress(name);
	if (!normalized.includes(".")) {
		throw new Error("Invalid domain name");
	}

	const id = crypto.randomUUID();
	const now = new Date();

	try {
		const [row] = await db
			.insert(domains)
			.values({
				id,
				name: normalized,
				isActive: true,
				catchAllEnabled: false,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return toDomainDto(row);
	} catch {
		throw new Error("Domain already exists");
	}
}

export async function updateDomain(
	db: Database,
	id: string,
	patch: {
		isActive?: boolean;
		catchAllEnabled?: boolean;
		catchAllMailboxId?: string | null;
	},
) {
	const existing = await getDomain(db, id);
	const now = new Date();

	const [row] = await db
		.update(domains)
		.set({
			isActive: patch.isActive ?? existing.isActive,
			catchAllEnabled: patch.catchAllEnabled ?? existing.catchAllEnabled,
			catchAllMailboxId:
				patch.catchAllMailboxId !== undefined
					? patch.catchAllMailboxId
					: existing.catchAllMailboxId,
			updatedAt: now,
		})
		.where(eq(domains.id, id))
		.returning();

	if (!row) {
		throw new Error("Domain not found");
	}

	return toDomainDto(row);
}

export async function removeDomain(
	db: Database,
	bucket: R2Bucket,
	id: string,
): Promise<void> {
	await getDomain(db, id);
	await deleteDomainCascade(db, bucket, id);
}
