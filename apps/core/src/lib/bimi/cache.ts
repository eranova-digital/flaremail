import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { bimiLogos, type BimiLogo } from "../../db/schema";
import {
	BIMI_NEGATIVE_TTL_MS,
	BIMI_POSITIVE_TTL_MS,
} from "./constants";
import { fetchBimiSvg } from "./fetch-logo";
import { bimiLogoStoragePrefix } from "./keys";
import { lookupBimiRecordForDomain } from "./lookup";
import {
	deleteBimiLogoObjects,
	storeBimiLogoVariants,
} from "./storage";

async function upsertLogoRow(db: Database, row: typeof bimiLogos.$inferInsert) {
	await db
		.insert(bimiLogos)
		.values(row)
		.onConflictDoUpdate({
			target: bimiLogos.domain,
			set: {
				status: row.status,
				sourceUrl: row.sourceUrl,
				storageKey: row.storageKey,
				checkedAt: row.checkedAt,
				expiresAt: row.expiresAt,
				logoUpdatedAt: row.logoUpdatedAt,
			},
		});
}

async function writeNegativeCache(
	db: Database,
	domain: string,
	now: Date,
): Promise<BimiLogo> {
	const row = {
		domain: domain.toLowerCase(),
		status: "missing" as const,
		sourceUrl: null,
		storageKey: null,
		checkedAt: now,
		expiresAt: new Date(now.getTime() + BIMI_NEGATIVE_TTL_MS),
		logoUpdatedAt: null,
	};
	await upsertLogoRow(db, row);
	return row;
}

/**
 * Return a cached BIMI logo row for `domain`, refreshing when expired.
 * Cache key is the publishing BIMI domain (lowercase).
 */
export async function getOrRefreshBimiLogo(
	db: Database,
	bucket: R2Bucket,
	domain: string,
): Promise<BimiLogo> {
	const normalized = domain.toLowerCase().trim();
	const now = new Date();

	const [existing] = await db
		.select()
		.from(bimiLogos)
		.where(eq(bimiLogos.domain, normalized))
		.limit(1);

	if (existing && existing.expiresAt.getTime() > now.getTime()) {
		return existing;
	}

	try {
		const lookup = await lookupBimiRecordForDomain(normalized);
		if (!lookup) {
			if (existing?.status === "found" && existing.storageKey) {
				await deleteBimiLogoObjects(bucket, normalized);
			}
			return writeNegativeCache(db, normalized, now);
		}

		const svg = await fetchBimiSvg(lookup.record.location);
		const { processBimiLogoSvg } = await import("./process-logo");
		const variants = await processBimiLogoSvg(svg);
		await storeBimiLogoVariants(bucket, normalized, variants);

		const row = {
			domain: normalized,
			status: "found" as const,
			sourceUrl: lookup.record.location,
			storageKey: bimiLogoStoragePrefix(normalized),
			checkedAt: now,
			expiresAt: new Date(now.getTime() + BIMI_POSITIVE_TTL_MS),
			logoUpdatedAt: now,
		};
		await upsertLogoRow(db, row);
		return row;
	} catch (error) {
		console.error(`BIMI cache refresh failed for ${normalized}:`, error);
		if (existing?.status === "found" && existing.storageKey) {
			try {
				await deleteBimiLogoObjects(bucket, normalized);
			} catch {
				// best-effort cleanup
			}
		}
		return writeNegativeCache(db, normalized, now);
	}
}

export { getBimiLogoObject } from "./storage";
