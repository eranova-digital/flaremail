import type { ThreadFolder, ThreadAction } from "../mailbox-types";

const DESTRUCTIVE_FOLDERS = new Set<ThreadFolder>(["trash", "spam", "archived"]);

export type ThreadMailboxSnapshot = {
	folder: ThreadFolder;
	restoreFolder: ThreadFolder | null;
};

export type ThreadActionUpdate = {
	folder?: ThreadFolder;
	restoreFolder?: ThreadFolder | null;
	isRead?: boolean;
	isStarred?: boolean;
	archivedAt?: Date | null;
	trashedAt?: Date | null;
	markedAsSpamAt?: Date | null;
};

export type ThreadActionPlan =
	| { kind: "noop" }
	| { kind: "update"; patch: ThreadActionUpdate };

function snapshotRestoreFolder(
	current: ThreadMailboxSnapshot,
): ThreadFolder | null {
	return DESTRUCTIVE_FOLDERS.has(current.folder)
		? current.restoreFolder
		: current.folder;
}

export function planThreadAction(
	existing: ThreadMailboxSnapshot,
	action: ThreadAction,
	now: Date = new Date(),
): ThreadActionPlan {
	switch (action) {
		case "archive": {
			if (existing.folder === "archived") {
				return { kind: "noop" };
			}

			return {
				kind: "update",
				patch: {
					restoreFolder: snapshotRestoreFolder(existing),
					folder: "archived",
					archivedAt: now,
				},
			};
		}
		case "trash": {
			if (existing.folder === "trash") {
				return { kind: "noop" };
			}

			return {
				kind: "update",
				patch: {
					restoreFolder: snapshotRestoreFolder(existing),
					folder: "trash",
					trashedAt: now,
				},
			};
		}
		case "spam": {
			if (existing.folder === "spam") {
				return { kind: "noop" };
			}

			return {
				kind: "update",
				patch: {
					restoreFolder: snapshotRestoreFolder(existing),
					folder: "spam",
					markedAsSpamAt: now,
				},
			};
		}
		case "restore": {
			const targetFolder = existing.restoreFolder ?? "inbox";
			return {
				kind: "update",
				patch: {
					folder: targetFolder,
					restoreFolder: null,
					archivedAt: null,
					trashedAt: null,
					markedAsSpamAt: null,
				},
			};
		}
		case "mark-read":
			return { kind: "update", patch: { isRead: true } };
		case "mark-unread":
			return { kind: "update", patch: { isRead: false } };
		case "star":
			return { kind: "update", patch: { isStarred: true } };
		case "unstar":
			return { kind: "update", patch: { isStarred: false } };
		default:
			throw new Error("Unknown thread action");
	}
}
