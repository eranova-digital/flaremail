import type { Message } from "../../db/schema";

export function toSendResponse(message: Message) {
	return {
		id: message.id,
		threadId: message.threadId,
		rfcMessageId: message.messageId,
		status: message.sendStatus,
	};
}
