import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../../db/client";
import { messageMailboxes } from "../../db/schema";
import { collectReadableMailboxIds } from "../auth/access";
import type { Principal } from "../auth/types";

export async function assertPrincipalCanReadMessage(
	db: Database,
	principal: Principal,
	messageId: string,
): Promise<void> {
	const readableMailboxIds = await collectReadableMailboxIds(db, principal);
	if (readableMailboxIds.size === 0) {
		throw new Error("Message not found");
	}

	const [link] = await db
		.select({ messageId: messageMailboxes.messageId })
		.from(messageMailboxes)
		.where(
			and(
				eq(messageMailboxes.messageId, messageId),
				inArray(
					messageMailboxes.mailboxId,
					[...readableMailboxIds],
				),
			),
		)
		.limit(1);

	if (!link) {
		throw new Error("Message not found");
	}
}
