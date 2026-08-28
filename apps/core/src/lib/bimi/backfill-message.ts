import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import type { Message } from "../../db/schema";
import { messages } from "../../db/schema";
import { parseTrustedDmarcFromHeaders } from "../mail-auth/parse-authentication-results";
import { resolveBimiForMessage } from "./resolve-for-message";

const HEADER_SCAN_BYTES = 64 * 1024;

function extractHeaderLine(headerBlock: string, name: string): string | null {
	const pattern = new RegExp(`^${name}:\\s*(.+)$`, "im");
	const match = headerBlock.match(pattern);
	return match?.[1]?.trim() ?? null;
}

/**
 * Re-evaluate BIMI eligibility from headers preserved on stored raw EML and
 * resolve the logo when a prior inbound pass missed async BIMI work.
 */
export async function backfillBimiForMessage(
	db: Database,
	bucket: R2Bucket,
	message: Pick<Message, "id" | "direction" | "bimiDomain" | "rawEmlKey">,
): Promise<string | null> {
	if (message.direction !== "inbound" || message.bimiDomain) {
		return message.bimiDomain;
	}

	const object = await bucket.get(message.rawEmlKey);
	if (!object) {
		return null;
	}

	const headerBytes = object.size > HEADER_SCAN_BYTES
		? await object.slice(0, HEADER_SCAN_BYTES).arrayBuffer()
		: await object.arrayBuffer();
	const headerBlock = new TextDecoder("utf-8", { fatal: false }).decode(
		headerBytes,
	);

	const trusted = parseTrustedDmarcFromHeaders(
		extractHeaderLine(headerBlock, "Authentication-Results"),
		extractHeaderLine(headerBlock, "ARC-Authentication-Results"),
	);
	if (!trusted?.eligibleForBimi || !trusted.alignedDomain) {
		return null;
	}

	await db
		.update(messages)
		.set({ dmarcResult: trusted.dmarcResult })
		.where(eq(messages.id, message.id));

	return resolveBimiForMessage(
		db,
		bucket,
		message.id,
		trusted.alignedDomain,
	);
}

export async function backfillBimiForMessages(
	db: Database,
	bucket: R2Bucket,
	messagesToBackfill: Array<
		Pick<Message, "id" | "direction" | "bimiDomain" | "rawEmlKey">
	>,
): Promise<void> {
	for (const message of messagesToBackfill) {
		try {
			await backfillBimiForMessage(db, bucket, message);
		} catch (error) {
			console.error(`BIMI backfill failed for message ${message.id}:`, error);
		}
	}
}
