export const MAILBOX_TYPES = [
	"primary",
	"secondary",
	"shared",
	"alias",
] as const;

export type MailboxType = (typeof MAILBOX_TYPES)[number];

export const RECEIVING_MAILBOX_TYPES = [
	"primary",
	"secondary",
	"shared",
] as const;

export type ReceivingMailboxType = (typeof RECEIVING_MAILBOX_TYPES)[number];

export function isReceivingMailboxType(
	type: MailboxType,
): type is ReceivingMailboxType {
	return type !== "alias";
}
