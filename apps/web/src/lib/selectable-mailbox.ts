import type { Mailbox } from "@/lib/api/client";

export function isSelectableMailbox(mailbox: Mailbox): boolean {
	return mailbox.type !== "alias";
}

export function getSelectableMailboxes(mailboxes: Mailbox[]): Mailbox[] {
	return mailboxes.filter(isSelectableMailbox);
}

export function resolveSelectableMailbox(
	mailboxes: Mailbox[],
	preferredId: string | null,
): Mailbox | undefined {
	const selectable = getSelectableMailboxes(mailboxes);
	if (selectable.length === 0) {
		return undefined;
	}

	return selectable.find((mailbox) => mailbox.id === preferredId) ?? selectable[0];
}
