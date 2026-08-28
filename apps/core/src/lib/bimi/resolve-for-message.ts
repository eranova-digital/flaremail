import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { messages } from "../../db/schema";
import { getOrRefreshBimiLogo } from "./cache";
import { bimiCandidateDomains } from "./lookup";

/**
 * Resolve and attach a BIMI publishing domain on an eligible inbound message.
 * Walks aligned From domain then organizational domain; sets `bimiDomain` only
 * when a found logo is cached.
 */
export async function resolveBimiForMessage(
	db: Database,
	bucket: R2Bucket,
	messageId: string,
	alignedDomain: string,
): Promise<string | null> {
	const candidates = bimiCandidateDomains(alignedDomain);

	for (const domain of candidates) {
		const logo = await getOrRefreshBimiLogo(db, bucket, domain);
		if (logo.status === "found") {
			await db
				.update(messages)
				.set({ bimiDomain: logo.domain })
				.where(eq(messages.id, messageId));
			return logo.domain;
		}
	}

	await db
		.update(messages)
		.set({ bimiDomain: null })
		.where(eq(messages.id, messageId));
	return null;
}
