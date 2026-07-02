export {
	deleteThreadIfEmpty,
	prepareThreadForMessage,
	type ThreadFolder,
	type ThreadTouchData,
} from "./touch-thread";

export { onMessagePersisted as finalizeThreadAfterInboundMessage } from "./thread-mailbox-sync";
export { prepareThreadForMessage as prepareThreadForInboundMessage } from "./touch-thread";
