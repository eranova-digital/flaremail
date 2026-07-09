import type { ThreadFolder } from "../mailbox-types";

export type ThreadTouchData = {
	subject: string | null;
	preview: string | null;
	lastMessageAt: Date;
	actualMailboxId: string;
	matchedMailboxId?: string | null;
	folder?: ThreadFolder;
	markUnread?: boolean;
};
