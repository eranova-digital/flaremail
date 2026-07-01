import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { messages } from "../db/schema";
import type { ThreadingHeaders } from "./threading-headers";
import { normalizeMessageId } from "./threading-headers";

export function resolveThreadIdFromLookup(
	threading: Pick<ThreadingHeaders, "inReplyTo" | "references">,
	lookup: (messageId: string) => string | null | undefined,
	createThreadId: () => string,
): string {
	if (threading.inReplyTo) {
		const threadId = lookup(threading.inReplyTo);
		if (threadId) {
			return threadId;
		}
	}

	if (threading.references?.length) {
		for (const messageId of [...threading.references].reverse()) {
			const threadId = lookup(messageId);
			if (threadId) {
				return threadId;
			}
		}
	}

	return createThreadId();
}

async function findThreadIdByMessageId(
	db: Database,
	messageId: string,
): Promise<string | null> {
	const candidates = new Set<string>([messageId]);
	const normalized = normalizeMessageId(messageId);
	if (normalized) {
		candidates.add(normalized);
	}

	for (const candidate of candidates) {
		const [row] = await db
			.select({ threadId: messages.threadId })
			.from(messages)
			.where(eq(messages.messageId, candidate))
			.limit(1);

		if (row) {
			return row.threadId;
		}
	}

	return null;
}

export async function resolveThreadId(
	db: Database,
	threading: Pick<ThreadingHeaders, "inReplyTo" | "references">,
): Promise<string> {
	const knownThreadIds = new Map<string, string>();
	const messageIdsToLookup = new Set<string>();

	if (threading.inReplyTo) {
		messageIdsToLookup.add(threading.inReplyTo);
	}

	if (threading.references?.length) {
		for (const messageId of threading.references) {
			messageIdsToLookup.add(messageId);
		}
	}

	await Promise.all(
		[...messageIdsToLookup].map(async (messageId) => {
			const threadId = await findThreadIdByMessageId(db, messageId);
			if (threadId) {
				knownThreadIds.set(messageId, threadId);
			}
		}),
	);

	return resolveThreadIdFromLookup(
		threading,
		(messageId) => knownThreadIds.get(messageId) ?? null,
		() => crypto.randomUUID(),
	);
}
