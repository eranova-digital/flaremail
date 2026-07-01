import { normalizeMessageId } from "./message-id";

export type ReplyThreadingHeaders = {
	inReplyTo: string;
	references: string[];
};

export function buildReplyThreading(parent: {
	messageId: string;
	references: string[] | null;
}): ReplyThreadingHeaders {
	const normalizedParentId = normalizeMessageId(parent.messageId);
	if (!normalizedParentId) {
		throw new Error("Parent message-id is required for reply threading");
	}

	const references = [...(parent.references ?? [])];
	if (!references.includes(normalizedParentId)) {
		references.push(normalizedParentId);
	}

	return {
		inReplyTo: normalizedParentId,
		references,
	};
}
