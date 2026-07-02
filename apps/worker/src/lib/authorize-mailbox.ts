import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { mailboxes } from "../db/schema";
import { isReceivingMailboxType } from "./mailbox-types";

export async function assertCanSendFrom(
	db: Database,
	mailboxId: string,
): Promise<void> {
	const [mailbox] = await db
		.select({ type: mailboxes.type, isActive: mailboxes.isActive })
		.from(mailboxes)
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);

	if (!mailbox) {
		throw new Error("Mailbox not found");
	}

	if (!mailbox.isActive) {
		throw new Error("Mailbox is not active");
	}

	if (!isReceivingMailboxType(mailbox.type)) {
		throw new Error("Alias mailboxes cannot send mail");
	}
}
