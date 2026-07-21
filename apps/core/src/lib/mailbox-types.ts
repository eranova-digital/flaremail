export const MAILBOX_TYPES = [
	"primary",
	"secondary",
	"shared",
	"alias",
	"system",
	"blackhole",
] as const;

export type MailboxType = (typeof MAILBOX_TYPES)[number];

export const USER_CREATABLE_MAILBOX_TYPES = ["shared", "alias"] as const;

export type UserCreatableMailboxType =
	(typeof USER_CREATABLE_MAILBOX_TYPES)[number];

export const RECEIVING_MAILBOX_TYPES = [
	"primary",
	"secondary",
	"shared",
	"system",
] as const;

export type ReceivingMailboxType = (typeof RECEIVING_MAILBOX_TYPES)[number];

export function isReceivingMailboxType(
	type: MailboxType,
): type is ReceivingMailboxType {
	return (RECEIVING_MAILBOX_TYPES as readonly string[]).includes(type);
}

export const SENDING_MAILBOX_TYPES = [
	"primary",
	"secondary",
	"shared",
	"system",
	"blackhole",
] as const;

export type SendingMailboxType = (typeof SENDING_MAILBOX_TYPES)[number];

export function isSendingMailboxType(
	type: MailboxType,
): type is SendingMailboxType {
	return (SENDING_MAILBOX_TYPES as readonly string[]).includes(type);
}

export function isBlackholeMailboxType(type: MailboxType): boolean {
	return type === "blackhole";
}

export const THREAD_FOLDERS = [
	"inbox",
	"spam",
	"trash",
	"archived",
	"drafts",
	"sent",
] as const;

export type ThreadFolder = (typeof THREAD_FOLDERS)[number];

export const THREAD_ACTIONS = [
	"archive",
	"trash",
	"spam",
	"restore",
	"mark-read",
	"mark-unread",
	"star",
	"unstar",
] as const;

export type ThreadAction = (typeof THREAD_ACTIONS)[number];

export function isThreadFolder(value: string): value is ThreadFolder {
	return (THREAD_FOLDERS as readonly string[]).includes(value);
}

export function isThreadAction(value: string): value is ThreadAction {
	return (THREAD_ACTIONS as readonly string[]).includes(value);
}
