import {
	Archive,
	ArchiveRestore,
	Mail,
	MailOpen,
	ShieldAlert,
	Star,
	Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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
		<TooltipProvider delayDuration={300}>
			<div className="flex flex-wrap gap-1">
				{thread.isRead ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								disabled={actionMutation.isPending}
								onClick={() => run("mark-unread")}
							>
								<Mail className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Mark unread</TooltipContent>
					</Tooltip>
				) : (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								disabled={actionMutation.isPending}
								onClick={() => run("mark-read")}
							>
								<MailOpen className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Mark read</TooltipContent>
					</Tooltip>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
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
						{thread.isStarred ? "Unstar" : "Star"}
					</TooltipContent>
				</Tooltip>

				{folder !== "archived" ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								disabled={actionMutation.isPending}
								onClick={() => run("archive")}
							>
								<Archive className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Archive</TooltipContent>
					</Tooltip>
				) : null}

				{folder !== "trash" ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								disabled={actionMutation.isPending}
								onClick={() => run("trash")}
							>
								<Trash2 className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Trash</TooltipContent>
					</Tooltip>
				) : null}

				{folder !== "spam" ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								disabled={actionMutation.isPending}
								onClick={() => run("spam")}
							>
								<ShieldAlert className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Spam</TooltipContent>
					</Tooltip>
				) : null}

				{folder === "trash" || folder === "spam" || folder === "archived" ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								disabled={actionMutation.isPending}
								onClick={() => run("restore")}
							>
								<ArchiveRestore className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Restore</TooltipContent>
					</Tooltip>
				) : null}
			</div>
		</TooltipProvider>
	);
}
