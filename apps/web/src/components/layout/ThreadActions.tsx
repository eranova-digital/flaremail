import {
	Archive,
	ArchiveRestore,
	Mail,
	MailOpen,
	MoreVertical,
	ShieldAlert,
	Star,
	Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ThreadLabelMenuItems } from "@/components/layout/ThreadLabelPicker";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThread, useThreadAction } from "@/hooks/use-thread";
import type { ThreadFolder } from "@/lib/api/client";

type ThreadActionsProps = {
	mailboxId: string;
	threadId: string;
	folder: ThreadFolder;
};

export function ThreadActions({
	mailboxId,
	threadId,
	folder,
}: ThreadActionsProps) {
	const { t } = useTranslation("mail");
	const threadQuery = useThread(mailboxId, threadId);
	const actionMutation = useThreadAction(mailboxId, threadId);
	const thread = threadQuery.data;

	if (!thread) {
		return null;
	}

	const run = (action: Parameters<typeof actionMutation.mutate>[0]) => {
		actionMutation.mutate(action);
	};

	const busy = actionMutation.isPending;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="size-8 shrink-0"
					aria-label={t("threadActions.menu")}
					disabled={busy}
				>
					<MoreVertical className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				{thread.isRead ? (
					<DropdownMenuItem disabled={busy} onSelect={() => run("mark-unread")}>
						<Mail className="size-4" />
						{t("threadActions.markUnread")}
					</DropdownMenuItem>
				) : (
					<DropdownMenuItem disabled={busy} onSelect={() => run("mark-read")}>
						<MailOpen className="size-4" />
						{t("threadActions.markRead")}
					</DropdownMenuItem>
				)}

				<DropdownMenuItem
					disabled={busy}
					onSelect={() => run(thread.isStarred ? "unstar" : "star")}
				>
					<Star
						className={
							thread.isStarred ? "size-4 fill-current text-amber-500" : "size-4"
						}
					/>
					{thread.isStarred ? t("threadActions.unstar") : t("threadActions.star")}
				</DropdownMenuItem>

				{folder !== "archived" ? (
					<DropdownMenuItem disabled={busy} onSelect={() => run("archive")}>
						<Archive className="size-4" />
						{t("threadActions.archive")}
					</DropdownMenuItem>
				) : null}

				{folder !== "trash" ? (
					<DropdownMenuItem disabled={busy} onSelect={() => run("trash")}>
						<Trash2 className="size-4" />
						{t("threadActions.trash")}
					</DropdownMenuItem>
				) : null}

				{folder !== "spam" ? (
					<DropdownMenuItem disabled={busy} onSelect={() => run("spam")}>
						<ShieldAlert className="size-4" />
						{t("threadActions.spam")}
					</DropdownMenuItem>
				) : null}

				{folder === "trash" || folder === "spam" || folder === "archived" ? (
					<DropdownMenuItem disabled={busy} onSelect={() => run("restore")}>
						<ArchiveRestore className="size-4" />
						{t("threadActions.restore")}
					</DropdownMenuItem>
				) : null}

				<DropdownMenuSeparator />
				<ThreadLabelMenuItems mailboxId={mailboxId} threadId={threadId} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
