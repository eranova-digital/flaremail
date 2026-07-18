import type { Message, Thread, ThreadMailbox } from "../../db/schema";
import type { SeenByViewer } from "../../lib/message-seen-by";
import type { ThreadParties } from "../../lib/thread-participants";
import { normalizeMessageId } from "../../lib/threading-headers";

export function buildRfcMessageIdToUuidMap(
	threadMessages: Message[],
): Map<string, string> {
	const map = new Map<string, string>();

	for (const message of threadMessages) {
		map.set(message.messageId, message.id);
		const normalized = normalizeMessageId(message.messageId);
		if (normalized) {
			map.set(normalized, message.id);
		}
	}

	return map;
}

export function resolveInReplyToMessageUuid(
	inReplyTo: string | null,
	rfcMessageIdToUuid: Map<string, string>,
): string | null {
	if (!inReplyTo) {
		return null;
	}

	const direct = rfcMessageIdToUuid.get(inReplyTo);
	if (direct) {
		return direct;
	}

	const normalized = normalizeMessageId(inReplyTo);
	if (!normalized) {
		return null;
	}

	return rfcMessageIdToUuid.get(normalized) ?? null;
}

export function toMessagePreview(message: Message) {
	return {
		id: message.id,
		threadId: message.threadId,
		subject: message.subject,
		preview: message.preview,
		from: message.from,
		to: message.to,
		cc: message.cc,
		bcc: message.bcc,
		direction: message.direction,
		sendStatus: message.sendStatus,
		hasHtml: message.hasHtml,
		hasAttachments: message.hasAttachments,
		sentAt: message.sentAt?.toISOString() ?? null,
		receivedAt: message.receivedAt.toISOString(),
	};
}

/**
 * Direction is stored once per message, but whether a message is "yours"
 * (rendered on the right) is relative to the viewer. Internal-to-internal mail
 * is kept as a single outbound row shared with internal recipients, so a
 * message only counts as outbound for the mailbox that actually sent it.
 */
export function resolveViewerDirection(
	message: Pick<Message, "direction" | "actualMailboxId">,
	viewerMailboxId?: string,
): Message["direction"] {
	if (!viewerMailboxId) {
		return message.direction;
	}

	return message.direction === "outbound" &&
		message.actualMailboxId === viewerMailboxId
		? "outbound"
		: "inbound";
}

export function toThreadMessagePreview(
	message: Message,
	inReplyTo: string | null = null,
	viewerMailboxId?: string,
) {
	const { threadId: _threadId, ...preview } = toMessagePreview(message);
	return {
		...preview,
		direction: resolveViewerDirection(message, viewerMailboxId),
		inReplyTo,
	};
}

export function toThreadMessageWithBody(
	message: Message,
	inReplyTo: string | null,
	body: {
		text: string | null;
		html: string | null;
		attachments: Array<{
			id: string;
			filename: string | null;
			mimeType: string;
			sizeBytes: number;
			disposition: string | null;
			contentId: string | null;
		}>;
	},
	viewerMailboxId?: string,
) {
	return {
		...toThreadMessagePreview(message, inReplyTo, viewerMailboxId),
		text: body.text,
		html: body.html,
		attachments: body.attachments,
	};
}

export function toThreadDto(
	thread: Pick<Thread, "id" | "subject">,
	mailboxView: ThreadMailbox,
	labelIds: string[],
	parties?: ThreadParties,
	seenBy: SeenByViewer[] = [],
) {
	return {
		id: thread.id,
		subject: thread.subject,
		preview: mailboxView.preview,
		lastMessageAt: mailboxView.lastMessageAt.toISOString(),
		messageCount: mailboxView.messageCount,
		isRead: mailboxView.isRead,
		isStarred: mailboxView.isStarred,
		folder: mailboxView.folder,
		labelIds,
		sender: parties?.sender ?? null,
		participants: parties?.participants ?? [],
		seenBy,
	};
}

export function toSearchHit(message: Message) {
	return {
		...toMessagePreview(message),
		threadId: message.threadId,
	};
}
