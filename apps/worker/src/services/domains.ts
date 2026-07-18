import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { domains } from "../db/schema";
import { isSchemaMismatchError, isUniqueViolation, schemaMismatchMessage } from "../lib/db/postgres-error";
import { normalizeEmailAddress } from "../lib/normalize-email-address";
import { provisionSystemMailboxes } from "../lib/system-mailboxes";
import { deleteDomainCascade } from "./cascade-delete";
import {
	getDomainReadinessSummary,
	startDomainValidation,
	toDomainReadinessSummaryDto,
} from "../lib/domain-validation";
import type { LogContext } from "../lib/logs/context";

export function toDomainDto(
	domain: {
		id: string;
		name: string;
		isActive: boolean;
		catchAllEnabled: boolean;
		catchAllMailboxId: string | null;
	},
	readiness?: ReturnType<typeof toDomainReadinessSummaryDto>,
) {
	return {
		id: domain.id,
		domain: domain.name,
		isActive: domain.isActive,
		catchAllEnabled: domain.catchAllEnabled,
		catchAllMailboxId: domain.catchAllMailboxId,
		readiness: readiness ?? toDomainReadinessSummaryDto(null),
	};
}

async function toDomainDtoWithReadiness(
	db: Database,
	domain: {
		id: string;
		name: string;
		isActive: boolean;
		catchAllEnabled: boolean;
		catchAllMailboxId: string | null;
	},
) {
	const readiness = await getDomainReadinessSummary(db, domain.id);
	return toDomainDto(domain, readiness);
}

export async function listDomains(db: Database) {
	const rows = await db.select().from(domains).orderBy(domains.name);
	return Promise.all(rows.map((row) => toDomainDtoWithReadiness(db, row)));
}

export async function getDomain(db: Database, id: string) {
	const [row] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
	if (!row) {
		throw new Error("Domain not found");
	}

	return toDomainDtoWithReadiness(db, row);
}

export async function createDomain(
	db: Database,
	name: string,
	email?: SendEmail,
	logMeta?: { actorAccountId?: string | null; context?: LogContext | null },
) {
	const normalized = normalizeEmailAddress(name);
	if (!normalized.includes(".")) {
		throw new Error("Invalid domain name");
	}

	const id = crypto.randomUUID();
	const now = new Date();

	try {
		const row = await db.transaction(async (tx) => {
			await tx.insert(domains).values({
				id,
				name: normalized,
				isActive: true,
				catchAllEnabled: false,
				createdAt: now,
				updatedAt: now,
			});

			await provisionSystemMailboxes(tx, id, normalized);

			const [created] = await tx
				.select()
				.from(domains)
				.where(eq(domains.id, id))
				.limit(1);
			if (!created) {
				throw new Error("Failed to create domain");
			}
			return created;
		});

		if (email) {
			try {
				await startDomainValidation(db, email, row.id, row.name, logMeta);
			} catch (error) {
				console.error("Initial domain validation failed to start:", error);
			}
		}

		return getDomain(db, row.id);
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new Error("Domain already exists");
		}
		if (isSchemaMismatchError(error)) {
			throw new Error(schemaMismatchMessage());
		}
		console.error("Domain creation failed:", error);
		throw error instanceof Error ? error : new Error("Failed to create domain");
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

	return toDomainDtoWithReadiness(db, row);
}

export async function removeDomain(
	db: Database,
	bucket: R2Bucket,
	id: string,
): Promise<void> {
	await getDomain(db, id);
	await deleteDomainCascade(db, bucket, id);
}

export async function getDomainRecord(db: Database, id: string) {
	const [row] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
	if (!row) {
		throw new Error("Domain not found");
	}
	return row;
}
