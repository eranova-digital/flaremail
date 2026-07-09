import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	attachments,
	domains,
	labels,
	mailboxes,
	messageMailboxes,
	messages,
	threadLabels,
	threadMailboxes,
} from "../db/schema";
import { refreshAllThreadMailboxes } from "../lib/thread-mailbox";
import { deleteR2Objects } from "../lib/r2-cleanup";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DeletionDb = Database | Transaction;

type OwnerCandidate = {
	mailboxId: string;
	type: string;
	createdAt: Date;
};

type DeletePlan = {
	r2Keys: string[];
	affectedThreadIds: Set<string>;
};

export function chooseReassignedOwner(
	candidates: OwnerCandidate[],
): string | null {
	const [owner] = candidates
		.filter((candidate) => candidate.type !== "alias")
		.sort((left, right) => {
			const createdAtDelta =
				left.createdAt.getTime() - right.createdAt.getTime();
			return createdAtDelta || left.mailboxId.localeCompare(right.mailboxId);
		});

	return owner?.mailboxId ?? null;
}

async function collectR2KeysForMessages(
	db: DeletionDb,
	messageIds: string[],
): Promise<string[]> {
	if (!messageIds.length) {
		return [];
	}

	const messageRows = await db
		.select({ rawEmlKey: messages.rawEmlKey })
		.from(messages)
		.where(inArray(messages.id, messageIds));

	const attachmentRows = await db
		.select({ storageKey: attachments.storageKey })
		.from(attachments)
		.where(inArray(attachments.messageId, messageIds));

	return [
		...messageRows.map((row) => row.rawEmlKey),
		...attachmentRows.map((row) => row.storageKey),
	];
}

async function deleteMessagesAndR2(
	db: DeletionDb,
	messageIds: string[],
): Promise<string[]> {
	if (!messageIds.length) {
		return [];
	}

	const keys = await collectR2KeysForMessages(db, messageIds);
	await db.delete(attachments).where(inArray(attachments.messageId, messageIds));
	await db.delete(messages).where(inArray(messages.id, messageIds));
	return keys;
}

async function collectMailboxIdsForDeletion(
	db: DeletionDb,
	seedMailboxIds: string[],
): Promise<string[]> {
	const ids = new Set(seedMailboxIds);
	let frontier = [...ids];

	while (frontier.length) {
		const aliasRows = await db
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(inArray(mailboxes.aliasTargetId, frontier));
		const next: string[] = [];

		for (const row of aliasRows) {
			if (!ids.has(row.id)) {
				ids.add(row.id);
				next.push(row.id);
			}
		}

		frontier = next;
	}

	return [...ids];
}

async function assertNotCatchAllTarget(
	db: DeletionDb,
	mailboxIds: string[],
): Promise<void> {
	if (!mailboxIds.length) {
		return;
	}

	const [domain] = await db
		.select({ id: domains.id })
		.from(domains)
		.where(
			and(
				eq(domains.catchAllEnabled, true),
				inArray(domains.catchAllMailboxId, mailboxIds),
			),
		)
		.limit(1);

	if (domain) {
		throw new Error(
			"Mailbox is configured as a domain catch-all target and cannot be deleted",
		);
	}
}

async function candidateOwnersForMessage(
	db: DeletionDb,
	messageId: string,
	deletingMailboxIds: string[],
): Promise<OwnerCandidate[]> {
	const rows = await db
		.select({
			mailboxId: mailboxes.id,
			type: mailboxes.type,
			createdAt: mailboxes.createdAt,
		})
		.from(messageMailboxes)
		.innerJoin(mailboxes, eq(messageMailboxes.mailboxId, mailboxes.id))
		.where(
			and(
				eq(messageMailboxes.messageId, messageId),
				ne(messageMailboxes.mailboxId, deletingMailboxIds[0]),
			),
		)
		.orderBy(asc(mailboxes.createdAt), asc(mailboxes.id));

	return rows.filter((row) => !deletingMailboxIds.includes(row.mailboxId));
}

async function deleteMailboxSet(
	db: DeletionDb,
	mailboxIds: string[],
): Promise<DeletePlan> {
	const plan: DeletePlan = { r2Keys: [], affectedThreadIds: new Set() };

	const linkedThreads = await db
		.select({ threadId: threadMailboxes.threadId })
		.from(threadMailboxes)
		.where(inArray(threadMailboxes.mailboxId, mailboxIds));
	for (const row of linkedThreads) {
		plan.affectedThreadIds.add(row.threadId);
	}

	const ownedMessages = await db
		.select({ id: messages.id, threadId: messages.threadId })
		.from(messages)
		.where(inArray(messages.actualMailboxId, mailboxIds));

	const deleteMessageIds: string[] = [];
	for (const message of ownedMessages) {
		plan.affectedThreadIds.add(message.threadId);
		const ownerId = chooseReassignedOwner(
			await candidateOwnersForMessage(db, message.id, mailboxIds),
		);

		if (ownerId) {
			await db
				.update(messages)
				.set({ actualMailboxId: ownerId })
				.where(eq(messages.id, message.id));
		} else {
			deleteMessageIds.push(message.id);
		}
	}

	if (deleteMessageIds.length) {
		plan.r2Keys.push(...(await deleteMessagesAndR2(db, deleteMessageIds)));
	}

	await db
		.update(messages)
		.set({ matchedMailboxId: null })
		.where(inArray(messages.matchedMailboxId, mailboxIds));
	await db
		.delete(messageMailboxes)
		.where(inArray(messageMailboxes.mailboxId, mailboxIds));
	await db
		.delete(threadMailboxes)
		.where(inArray(threadMailboxes.mailboxId, mailboxIds));
	await db.delete(labels).where(inArray(labels.mailboxId, mailboxIds));
	await db.delete(mailboxes).where(inArray(mailboxes.id, mailboxIds));

	for (const threadId of plan.affectedThreadIds) {
		await refreshAllThreadMailboxes(db, threadId);
	}

	return plan;
}

export async function deleteMailboxCascade(
	db: Database,
	bucket: R2Bucket,
	mailboxId: string,
): Promise<void> {
	const r2Keys = await db.transaction(async (tx) => {
		const mailboxIds = await collectMailboxIdsForDeletion(tx, [mailboxId]);
		await assertNotCatchAllTarget(tx, mailboxIds);
		const plan = await deleteMailboxSet(tx, mailboxIds);
		return plan.r2Keys;
	});

	await deleteR2Objects(bucket, r2Keys);
}

export async function deleteDomainCascade(
	db: Database,
	bucket: R2Bucket,
	domainId: string,
): Promise<void> {
	const r2Keys = await db.transaction(async (tx) => {
		const domainMailboxes = await tx
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(eq(mailboxes.domainId, domainId));
		const mailboxIds = await collectMailboxIdsForDeletion(
			tx,
			domainMailboxes.map((mailbox) => mailbox.id),
		);
		const plan = await deleteMailboxSet(tx, mailboxIds);
		await tx.delete(domains).where(eq(domains.id, domainId));
		return plan.r2Keys;
	});

	await deleteR2Objects(bucket, r2Keys);
}

export async function deleteOrphanThreadLabels(
	db: Database,
	threadId: string,
): Promise<void> {
	const threadLabelRows = await db
		.select({ labelId: threadLabels.labelId })
		.from(threadLabels)
		.where(eq(threadLabels.threadId, threadId));

	if (!threadLabelRows.length) {
		return;
	}

	const labelIds = threadLabelRows.map((row) => row.labelId);
	const existingLabels = await db
		.select({ id: labels.id })
		.from(labels)
		.where(inArray(labels.id, labelIds));

	const existingIds = new Set(existingLabels.map((row) => row.id));
	const staleIds = labelIds.filter((id) => !existingIds.has(id));

	if (staleIds.length) {
		await db
			.delete(threadLabels)
			.where(
				and(
					eq(threadLabels.threadId, threadId),
					inArray(threadLabels.labelId, staleIds),
				),
			);
	}
}
