import type { ThreadFolder } from "@/lib/api/client";

export const FOLDERS: ThreadFolder[] = [
	"inbox",
	"sent",
	"drafts",
	"archived",
	"trash",
	"spam",
];

export const FOLDER_LABELS: Record<ThreadFolder, string> = {
	inbox: "Inbox",
	sent: "Sent",
	drafts: "Drafts",
	archived: "Archived",
	trash: "Trash",
	spam: "Spam",
};

export function isThreadFolder(value: string): value is ThreadFolder {
	return FOLDERS.includes(value as ThreadFolder);
}
