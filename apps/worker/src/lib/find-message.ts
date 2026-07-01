import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { messages } from "../db/schema";

export async function findMessageRowByRfcMessageId(
	db: Database,
	rfcMessageId: string,
): Promise<{ id: string } | null> {
	const [row] = await db
		.select({ id: messages.id })
		.from(messages)
		.where(eq(messages.messageId, rfcMessageId))
		.limit(1);

	return row ?? null;
}
