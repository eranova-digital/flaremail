import type { Message, Thread, ThreadMailbox } from "../db/schema";
import type { ThreadParties } from "../lib/thread-participants";
import { isSystemManagedMailbox } from "../lib/system-mailboxes";
import { normalizeMessageId } from "../lib/threading-headers";
import type { SeenByViewer } from "../lib/message-seen-by";

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

export function toDomainDto(
	domain: {
		id: string;
		name: string;
		isActive: boolean;
		catchAllEnabled: boolean;
		catchAllMailboxId: string | null;
	},
	readiness?: ReturnType<typeof toDomainReadinessSummaryDto>,
) {
	return {
		id: domain.id,
		domain: domain.name,
		isActive: domain.isActive,
		catchAllEnabled: domain.catchAllEnabled,
		catchAllMailboxId: domain.catchAllMailboxId,
		readiness: readiness ?? toDomainReadinessSummaryDto(null),
	};
}

export function toDomainReadinessSummaryDto(
	run: {
		id: string;
		badge: string;
		status: string;
		startedAt: Date;
		finishedAt: Date | null;
	} | null,
) {
	if (!run) {
		return {
			badge: null,
			latestRunId: null,
			latestRunStartedAt: null,
			latestRunFinishedAt: null,
		};
	}

	return {
		badge: run.badge,
		latestRunId: run.id,
		latestRunStartedAt: run.startedAt.toISOString(),
		latestRunFinishedAt: run.finishedAt?.toISOString() ?? null,
	};
}

export function toValidationCheckDto(check: {
	checkKey: string;
	tier: string;
	status: string;
	code: string | null;
	message: string | null;
	checkedAt: Date | null;
}) {
	return {
		checkKey: check.checkKey,
		tier: check.tier,
		status: check.status,
		code: check.code,
		message: check.message,
		checkedAt: check.checkedAt?.toISOString() ?? null,
	};
}

export function toValidationLogEventDto(event: {
	id: string;
	level: string;
	stage: string;
	code: string | null;
	message: string;
	createdAt: Date;
}) {
	return {
		id: event.id,
		level: event.level,
		stage: event.stage,
		code: event.code,
		message: event.message,
		createdAt: event.createdAt.toISOString(),
	};
}

export function toValidationRunSummaryDto(run: {
	id: string;
	status: string;
	badge: string;
	startedAt: Date;
	finishedAt: Date | null;
}) {
	return {
		id: run.id,
		status: run.status,
		badge: run.badge,
		startedAt: run.startedAt.toISOString(),
		finishedAt: run.finishedAt?.toISOString() ?? null,
	};
}

export function toValidationRunDetailDto(
	run: {
		id: string;
		domainId: string;
		status: string;
		badge: string;
		startedAt: Date;
		finishedAt: Date | null;
		receiveDeadlineAt: Date | null;
	},
	checks: ReturnType<typeof toValidationCheckDto>[],
	logs: ReturnType<typeof toValidationLogEventDto>[],
) {
	return {
		...toValidationRunSummaryDto(run),
		domainId: run.domainId,
		receiveDeadlineAt: run.receiveDeadlineAt?.toISOString() ?? null,
		checks,
		logs,
	};
}

export function toMailboxDto(mailbox: {
	id: string;
	domainId: string;
	address: string;
	localPart: string;
	type: string;
	aliasTargetId: string | null;
	aliasTargetAddress: string | null;
	isActive: boolean;
}) {
	return {
		id: mailbox.id,
		domainId: mailbox.domainId,
		address: mailbox.address,
		localPart: mailbox.localPart,
		type: mailbox.type,
		aliasTargetId: mailbox.aliasTargetId,
		aliasTargetAddress: mailbox.aliasTargetAddress,
		isActive: mailbox.isActive,
		isSystemManaged: isSystemManagedMailbox(mailbox),
	};
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

export function toSendResponse(message: Message) {
	return {
		id: message.id,
		threadId: message.threadId,
		rfcMessageId: message.messageId,
		status: message.sendStatus,
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

export function toLabelDto(label: {
	id: string;
	mailboxId: string;
	name: string;
	color: string | null;
}) {
	return {
		id: label.id,
		mailboxId: label.mailboxId,
		name: label.name,
		color: label.color,
	};
}

export function toSearchHit(message: Message) {
	return {
		...toMessagePreview(message),
		threadId: message.threadId,
	};
}
