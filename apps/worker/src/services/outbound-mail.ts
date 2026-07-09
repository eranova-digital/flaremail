import type { OutboundContext } from "../lib/messages/outbound-context";
import { createOutboundContext } from "../lib/messages/outbound-context";
import {
	createDraft,
	deleteDraft,
	getDraft,
	updateDraft,
} from "../lib/messages/draft-lifecycle";
import {
	directSend,
	forwardMessage,
	replyToMessage,
	sendDraftMessage,
} from "../lib/messages/outbound-commands";
import type {
	CreateDraftBody,
	ForwardBody,
	OutboundMessageBody,
	ReplyBody,
	SendMessageBody,
} from "../lib/messages/outbound-payload";

export type OutboundMailContext = OutboundContext;
export { createOutboundContext };

export const OutboundMail = {
	send: (ctx: OutboundMailContext, mailboxId: string, body: SendMessageBody) =>
		directSend(ctx, mailboxId, body),
	createDraft: (ctx: OutboundMailContext, body: CreateDraftBody) =>
		createDraft(ctx, body),
	updateDraft: (
		ctx: OutboundMailContext,
		messageId: string,
		body: OutboundMessageBody,
	) => updateDraft(ctx, messageId, body),
	deleteDraft: (ctx: OutboundMailContext, messageId: string) =>
		deleteDraft(ctx, messageId),
	getDraft: (ctx: OutboundMailContext, messageId: string) =>
		getDraft(ctx, messageId),
	sendDraft: (ctx: OutboundMailContext, messageId: string) =>
		sendDraftMessage(ctx, messageId),
	reply: (
		ctx: OutboundMailContext,
		parentMessageId: string,
		body: ReplyBody,
	) => replyToMessage(ctx, parentMessageId, body),
	forward: (
		ctx: OutboundMailContext,
		parentMessageId: string,
		body: ForwardBody,
	) => forwardMessage(ctx, parentMessageId, body),
} as const;
