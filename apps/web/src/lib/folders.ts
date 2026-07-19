import type { ThreadFolder } from "@/lib/api/client";
import i18n from "@/lib/i18n";

export const FOLDERS: ThreadFolder[] = [
	"inbox",
	"sent",
	"drafts",
	"archived",
	"trash",
	"spam",
];

export function folderLabel(folder: ThreadFolder): string {
	return i18n.t(`folders.${folder}`, { ns: "common" });
}

/** @deprecated Prefer folderLabel() for locale-aware names. */
export const FOLDER_LABELS: Record<ThreadFolder, string> = {
	get inbox() {
		return folderLabel("inbox");
	},
	get sent() {
		return folderLabel("sent");
	},
	get drafts() {
		return folderLabel("drafts");
	},
	get archived() {
		return folderLabel("archived");
	},
	get trash() {
		return folderLabel("trash");
	},
	get spam() {
		return folderLabel("spam");
	},
};

export function isThreadFolder(value: string): value is ThreadFolder {
	return FOLDERS.includes(value as ThreadFolder);
}
