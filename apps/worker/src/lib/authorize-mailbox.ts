import type { Database } from "../db/client";

export async function assertCanSendFrom(
	_db: Database,
	_mailboxId: string,
): Promise<void> {
	// TODO: verify user has access to send from this mailbox (primary/secondary/shared).
}
