import type { Email } from "postal-mime";
import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { mailboxes } from "../../db/schema";
import { formatAddress } from "../format-address";
import { normalizeEmailAddress } from "../normalize-email-address";

/**
 * Detects mail that originated from one of our own mailboxes looping back in.
 *
 * When an outbound message is addressed to (or CC/BCC's) an internal mailbox,
 * Cloudflare Email Routing delivers a copy back into the worker. That copy
 * shares the outbound message's RFC Message-ID, so storing it would create a
 * duplicate row that collides on the unique Message-ID and makes the sender's
 * own message render as inbound.
 *
 * The outbound send already links every internal recipient to the canonical
 * outbound message, so these loopback copies can be dropped. Detection is based
 * on the sender: a message whose From address belongs to one of our mailboxes
 * was sent by us.
 */
export async function isSelfSentLoopback(
	db: Database,
	parsed: Email,
	message: ForwardableEmailMessage,
): Promise<boolean> {
	const sender = formatAddress(parsed.from ?? undefined) ?? message.from;
	const normalized = normalizeEmailAddress(sender ?? "");
	if (!normalized) {
		return false;
	}

	const [row] = await db
		.select({ id: mailboxes.id })
		.from(mailboxes)
		.where(eq(mailboxes.address, normalized))
		.limit(1);

	return Boolean(row);
}
