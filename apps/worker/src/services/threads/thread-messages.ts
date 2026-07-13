import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accountProfiles, accounts, messageMailboxes, messages } from "../../db/schema";
import { isSharedMailbox } from "../../lib/thread-seen-by";
import { loadMessageBody } from "../../lib/messages/message-body";
import { toProfilePicturePayload } from "../../lib/profile-picture/payload";
import {
	buildRfcMessageIdToUuidMap,
	resolveInReplyToMessageUuid,
	toThreadMessagePreview,
	toThreadMessageWithBody,
} from "../dto";
import { getThread } from "./thread-queries";

export async function listThreadMessages(
	db: Database,
	threadId: string,
	mailboxId: string,
	options?: { bucket?: R2Bucket; includeBody?: boolean },
) {
	const thread = await getThread(db, threadId, mailboxId);

	const rows = await db
		.select({ message: messages })
		.from(messages)
		.innerJoin(
			messageMailboxes,
			and(
				eq(messageMailboxes.messageId, messages.id),
				eq(messageMailboxes.mailboxId, mailboxId),
			),
		)
		.where(eq(messages.threadId, threadId))
		.orderBy(asc(messages.receivedAt));

	const messageRows = rows.map((row) => row.message);
	const rfcMessageIdToUuid = buildRfcMessageIdToUuidMap(messageRows);

	const sharedViewer = await isSharedMailbox(db, mailboxId);
	const sentByIds = sharedViewer
		? [
				...new Set(
					messageRows
						.filter((m) => m.direction === "outbound" && Boolean(m.sentByAccountId))
						.map((m) => m.sentByAccountId!),
				),
			]
		: [];

	const sentByMap = new Map<
		string,
		{
			accountId: string;
			loginIdentifier: string;
			displayName: string;
			profilePicture: ReturnType<typeof toProfilePicturePayload>;
		}
	>();
	if (sentByIds.length > 0) {
		const rows = await db
			.select({
				accountId: accounts.id,
				loginIdentifier: accounts.loginIdentifier,
				firstName: accountProfiles.firstName,
				lastName: accountProfiles.lastName,
				profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt,
			})
			.from(accounts)
			.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
			.where(inArray(accounts.id, sentByIds));

		for (const row of rows) {
			sentByMap.set(row.accountId, {
				accountId: row.accountId,
				loginIdentifier: row.loginIdentifier,
				displayName:
					[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
					row.loginIdentifier,
				profilePicture: toProfilePicturePayload(row.profilePictureUpdatedAt),
			});
		}
	}

	const mapped = await Promise.all(
		messageRows.map(async (message) => {
			const inReplyTo = resolveInReplyToMessageUuid(
				message.inReplyTo,
				rfcMessageIdToUuid,
			);

			if (options?.includeBody && options.bucket) {
				const body = await loadMessageBody(db, options.bucket, message);
				const dto = toThreadMessageWithBody(message, inReplyTo, body, mailboxId) as any;
				if (sharedViewer && message.direction === "outbound") {
					dto.sentBy = message.sentByAccountId
						? sentByMap.get(message.sentByAccountId) ?? null
						: null;
				}
				return dto;
			}

			const dto = toThreadMessagePreview(message, inReplyTo, mailboxId) as any;
			if (sharedViewer && message.direction === "outbound") {
				dto.sentBy = message.sentByAccountId
					? sentByMap.get(message.sentByAccountId) ?? null
					: null;
			}
			return dto;
		}),
	);

	return {
		thread,
		messages: mapped,
	};
}
