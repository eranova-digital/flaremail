import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { domains, mailboxes } from "../db/schema";
import { isSendingMailboxType } from "./mailbox-types";

export type SendMailbox = {
	id: string;
	address: string;
	domain: string;
	type: "primary" | "secondary" | "shared" | "system" | "blackhole";
};

export async function loadMailboxForSend(
	db: Database,
	mailboxId: string,
): Promise<SendMailbox | null> {
	const [row] = await db
		.select({
			id: mailboxes.id,
			address: mailboxes.address,
			type: mailboxes.type,
			domain: domains.name,
		})
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(
			and(
				eq(mailboxes.id, mailboxId),
				eq(mailboxes.isActive, true),
				eq(domains.isActive, true),
			),
		)
		.limit(1);

	if (!row || !isSendingMailboxType(row.type)) {
		return null;
	}

	return {
		id: row.id,
		address: row.address,
		domain: row.domain,
		type: row.type,
	};
}

export async function loadBlackholeMailboxForDomain(
	db: Database,
	domainName: string,
): Promise<SendMailbox | null> {
	const [row] = await db
		.select({
			id: mailboxes.id,
			address: mailboxes.address,
			type: mailboxes.type,
			domain: domains.name,
		})
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(
			and(
				eq(domains.name, domainName),
				eq(mailboxes.type, "blackhole"),
				eq(mailboxes.isActive, true),
				eq(domains.isActive, true),
			),
		)
		.limit(1);

	if (!row || !isSendingMailboxType(row.type)) {
		return null;
	}

	return {
		id: row.id,
		address: row.address,
		domain: row.domain,
		type: row.type,
	};
}
