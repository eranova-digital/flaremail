export type {
	DraftDeletedEvent,
	DraftUpdatedEvent,
	MessagePersistedEvent,
	OutboundSentEvent,
	ThreadTouchData,
} from "./types";

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
	planThreadAction,
	type ThreadActionPlan,
	type ThreadActionUpdate,
	type ThreadMailboxSnapshot,
} from "./plan-thread-action";

export {
	deleteThreadIfEmpty,
	onDraftDeleted,
	onDraftUpdated,
	onMessagePersisted,
	onOutboundSent,
	prepareThreadForMessage,
} from "./lifecycle";
