export type { ThreadTouchData } from "./types";

export {
	assertMessageVisibleInMailbox,
	assertThreadInMailbox,
	findThreadMailbox,
} from "./access";

export {
	folderAfterInboundMessage,
	folderForNonDraftThread,
	headerValuesForMessageVisibility,
	linkMessageMailboxes,
	reconcileThreadFolderFromMessages,
	refreshAllThreadMailboxes,
	refreshThreadMailboxStats,
	resolveMessageMailboxIds,
	sendRelinkMailboxIds,
} from "./persistence";

export {
	deleteThreadIfEmpty,
	finalizeThreadOnOutboundSend,
	onDraftDeleted,
	onDraftUpdated,
	onMessagePersisted,
	onOutboundSent,
	prepareThreadForMessage,
	refreshThreadAfterDraftDelete,
} from "./lifecycle";
