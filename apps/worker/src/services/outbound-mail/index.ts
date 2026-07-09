import type { OutboundContext } from "../../lib/messages/outbound-context";
import { createOutboundContext } from "../../lib/messages/outbound-context";
import type {
	CreateDraftBody,
	ForwardBody,
	OutboundMessageBody,
	ReplyBody,
	SendMessageBody,
} from "../../lib/messages/outbound-payload";
import {
	directSend,
	forwardMessage,
	replyToMessage,
	sendDraftMessage,
} from "./commands";
import {
	createDraft,
	deleteDraft,
	getDraft,
	updateDraft,
} from "./drafts";

export type OutboundMailContext = OutboundContext;
export { createOutboundContext };

/**
 * Deep outbound module: send, reply, forward, and draft lifecycle behind one
 * interface. Context is bound at construction — callers pass intents only.
 */
export class OutboundMail {
	constructor(private readonly ctx: OutboundContext) {}

	send(mailboxId: string, body: SendMessageBody) {
		return directSend(this.ctx, mailboxId, body);
	}

	createDraft(body: CreateDraftBody) {
		return createDraft(this.ctx, body);
	}

	updateDraft(messageId: string, body: OutboundMessageBody) {
		return updateDraft(this.ctx, messageId, body);
	}

	deleteDraft(messageId: string) {
		return deleteDraft(this.ctx, messageId);
	}

	getDraft(messageId: string) {
		return getDraft(this.ctx, messageId);
	}

	sendDraft(messageId: string) {
		return sendDraftMessage(this.ctx, messageId);
	}

	reply(parentMessageId: string, body: ReplyBody) {
		return replyToMessage(this.ctx, parentMessageId, body);
	}

	forward(parentMessageId: string, body: ForwardBody) {
		return forwardMessage(this.ctx, parentMessageId, body);
	}
}

export function createOutboundMail(ctx: OutboundContext): OutboundMail {
	return new OutboundMail(ctx);
}
