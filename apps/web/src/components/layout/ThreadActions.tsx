import {
	Archive,
	ArchiveRestore,
	Mail,
	MailOpen,
	ShieldAlert,
	Star,
	Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ThreadLabelPicker } from "@/components/layout/ThreadLabelPicker";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useThread, useThreadAction } from "@/hooks/use-thread";
import type { ThreadFolder } from "@/lib/api/client";

const actionButtonClassName = "size-8 sm:size-9";

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

	return (
		<div className="flex max-w-full flex-wrap justify-end gap-1">
			{thread.isRead ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className={actionButtonClassName}
							disabled={actionMutation.isPending}
							onClick={() => run("mark-unread")}
						>
							<Mail className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("threadActions.markUnread")}</TooltipContent>
				</Tooltip>
			) : (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className={actionButtonClassName}
							disabled={actionMutation.isPending}
							onClick={() => run("mark-read")}
						>
							<MailOpen className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("threadActions.markRead")}</TooltipContent>
				</Tooltip>
			)}

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className={actionButtonClassName}
						disabled={actionMutation.isPending}
						onClick={() => run(thread.isStarred ? "unstar" : "star")}
					>
						<Star
							className={
								thread.isStarred ? "size-4 fill-current text-amber-500" : "size-4"
							}
						/>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					{thread.isStarred ? t("threadActions.unstar") : t("threadActions.star")}
				</TooltipContent>
			</Tooltip>

			<ThreadLabelPicker mailboxId={mailboxId} threadId={threadId} />

			{folder !== "archived" ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className={actionButtonClassName}
							disabled={actionMutation.isPending}
							onClick={() => run("archive")}
						>
							<Archive className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("threadActions.archive")}</TooltipContent>
				</Tooltip>
			) : null}

			{folder !== "trash" ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className={actionButtonClassName}
							disabled={actionMutation.isPending}
							onClick={() => run("trash")}
						>
							<Trash2 className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("threadActions.trash")}</TooltipContent>
				</Tooltip>
			) : null}

			{folder !== "spam" ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className={actionButtonClassName}
							disabled={actionMutation.isPending}
							onClick={() => run("spam")}
						>
							<ShieldAlert className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("threadActions.spam")}</TooltipContent>
				</Tooltip>
			) : null}

			{folder === "trash" || folder === "spam" || folder === "archived" ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className={actionButtonClassName}
							disabled={actionMutation.isPending}
							onClick={() => run("restore")}
						>
							<ArchiveRestore className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("threadActions.restore")}</TooltipContent>
				</Tooltip>
			) : null}
		</div>
	);
}
