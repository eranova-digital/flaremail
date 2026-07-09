import type { Mailbox, ThreadFolder } from "@/lib/api/client";
import { FOLDERS, FOLDER_LABELS, isThreadFolder } from "@/lib/folders";

const RECEIVING_FOLDERS = new Set<ThreadFolder>(["inbox", "spam"]);

export function isBlackholeMailbox(mailbox: Pick<Mailbox, "type">): boolean {
	return mailbox.type === "blackhole";
}

export function getDefaultFolderForMailbox(
	mailbox: Pick<Mailbox, "type">,
): ThreadFolder {
	return isBlackholeMailbox(mailbox) ? "sent" : "inbox";
}

export function getFoldersForMailbox(mailbox: Pick<Mailbox, "type">): ThreadFolder[] {
	if (!isBlackholeMailbox(mailbox)) {
		return FOLDERS;
	}

	return FOLDERS.filter((folder) => !RECEIVING_FOLDERS.has(folder));
}

export function resolveFolderForMailbox(
	mailbox: Pick<Mailbox, "type">,
	folder: string | null | undefined,
): ThreadFolder {
	const defaultFolder = getDefaultFolderForMailbox(mailbox);
	if (!folder || !isThreadFolder(folder)) {
		return defaultFolder;
	}

	const allowedFolders = getFoldersForMailbox(mailbox);
	return allowedFolders.includes(folder) ? folder : defaultFolder;
}

export { FOLDER_LABELS, isThreadFolder };
