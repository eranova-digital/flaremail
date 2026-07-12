import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { mailboxes } from "../../db/schema";
import { isSystemManagedMailbox } from "../system-mailboxes";
import { accessibleMailboxIds, hasDomainAccess } from "./principal";
import type { Principal } from "./types";

export class MailboxAccessDeniedError extends Error {
	constructor() {
		super("You do not have permission to access this mailbox");
		this.name = "MailboxAccessDeniedError";
	}
}

export async function assertPrincipalCanAccessMailbox(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	if (principal.kind === "legacy") {
		return;
	}

	if (principal.isIntendant) {
		const [mailbox] = await db
			.select({
				type: mailboxes.type,
				localPart: mailboxes.localPart,
			})
			.from(mailboxes)
			.where(eq(mailboxes.id, mailboxId))
			.limit(1);

		if (!mailbox || !isSystemManagedMailbox(mailbox)) {
			throw new MailboxAccessDeniedError();
		}
		return;
	}

	if (principal.role === "superadmin") {
		return;
	}

	if (principal.role === "admin") {
		const [mailbox] = await db
			.select({ domainId: mailboxes.domainId })
			.from(mailboxes)
			.where(eq(mailboxes.id, mailboxId))
			.limit(1);

		if (!mailbox) {
			throw new Error("Mailbox not found");
		}

		if (hasDomainAccess(principal, mailbox.domainId)) {
			return;
		}
	}

	const allowed = accessibleMailboxIds(principal);
	if (allowed.has(mailboxId)) {
		return;
	}

	throw new MailboxAccessDeniedError();
}
