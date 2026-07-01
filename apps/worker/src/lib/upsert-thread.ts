export {
	deleteThreadIfEmpty,
	prepareThreadForMessage,
	type ThreadFolder,
	type ThreadTouchData,
} from "./touch-thread";

export { syncThreadMailboxesAfterMessage as finalizeThreadAfterInboundMessage } from "./message-mailboxes";
export { prepareThreadForMessage as prepareThreadForInboundMessage } from "./touch-thread";
