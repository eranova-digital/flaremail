import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { domains, mailboxes } from "../db/schema";
import { isReceivingMailboxType } from "../lib/mailbox-types";
import type { MailboxType } from "../lib/mailbox-types";
import {
	buildEmailAddress,
	normalizeEmailAddress,
	parseEmailAddress,
} from "../lib/normalize-email-address";
import { deleteMailboxCascade } from "./cascade-delete";
import { toMailboxDto } from "./dto";

export async function listMailboxes(db: Database) {
	const rows = await db.select().from(mailboxes).orderBy(mailboxes.address);
	return rows.map(toMailboxDto);
}

export async function getMailbox(db: Database, id: string) {
	const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, id)).limit(1);
	if (!row) {
		throw new Error("Mailbox not found");
	}

	return toMailboxDto(row);
}

export async function createMailbox(
	db: Database,
	input: {
		address: string;
		domainId: string;
		type: MailboxType;
		aliasTargetId?: string;
	},
) {
	const parsed = parseEmailAddress(input.address);
	if (!parsed) {
		throw new Error("Invalid mailbox address");
	}

	const [domain] = await db
		.select()
		.from(domains)
		.where(eq(domains.id, input.domainId))
		.limit(1);

	if (!domain) {
		throw new Error("Domain not found");
	}

	if (normalizeEmailAddress(parsed.domain) !== normalizeEmailAddress(domain.name)) {
		throw new Error("Address domain does not match domainId");
	}

	if (input.type === "alias") {
		if (!input.aliasTargetId) {
			throw new Error("aliasTargetId is required for alias mailboxes");
		}

		const [target] = await db
			.select({ id: mailboxes.id, type: mailboxes.type })
			.from(mailboxes)
			.where(eq(mailboxes.id, input.aliasTargetId))
			.limit(1);

		if (!target || !isReceivingMailboxType(target.type)) {
			throw new Error("aliasTargetId must reference a receiving mailbox");
		}
	} else if (input.aliasTargetId) {
		throw new Error("aliasTargetId is only valid for alias mailboxes");
	}

	const id = crypto.randomUUID();
	const now = new Date();
	const address = buildEmailAddress(parsed.localPart, domain.name);

	try {
		const [row] = await db
			.insert(mailboxes)
			.values({
				id,
				domainId: input.domainId,
				localPart: parsed.localPart,
				address,
				type: input.type,
				aliasTargetId: input.aliasTargetId ?? null,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return toMailboxDto(row);
	} catch {
		throw new Error("Mailbox already exists");
	}
}

export async function updateMailbox(
	db: Database,
	id: string,
	patch: { isActive?: boolean },
) {
	await getMailbox(db, id);
	const now = new Date();

	const [row] = await db
		.update(mailboxes)
		.set({
			...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
			updatedAt: now,
		})
		.where(eq(mailboxes.id, id))
		.returning();

	if (!row) {
		throw new Error("Mailbox not found");
	}

	return toMailboxDto(row);
}

export async function removeMailbox(
	db: Database,
	bucket: R2Bucket,
	id: string,
): Promise<void> {
	await getMailbox(db, id);
	await deleteMailboxCascade(db, bucket, id);
}
