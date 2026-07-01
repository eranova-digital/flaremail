import { ChevronDown, Mail } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { setLastMailboxId } from "@/lib/mailbox-preference";
import { isThreadFolder } from "@/lib/folders";
import type { ThreadFolder } from "@/lib/api/client";

export function MailboxSwitcher() {
	const navigate = useNavigate();
	const { mailboxId, folder: folderParam, threadId } = useParams();
	const [searchParams] = useSearchParams();
	const mailboxesQuery = useMailboxes();

	const currentFolder: ThreadFolder =
		folderParam && isThreadFolder(folderParam)
			? folderParam
			: isThreadFolder(searchParams.get("folder") ?? "")
				? (searchParams.get("folder") as ThreadFolder)
				: "inbox";

	if (mailboxesQuery.isLoading) {
		return <Skeleton className="h-9 w-full" />;
	}

	const mailboxes = mailboxesQuery.data ?? [];
	const active =
		mailboxes.find((mailbox) => mailbox.id === mailboxId) ?? mailboxes[0];

	if (!active?.id) {
		return (
			<div className="text-muted-foreground px-2 text-xs">
				No mailboxes found
			</div>
		);
	}

	const switchMailbox = (nextMailboxId: string) => {
		setLastMailboxId(nextMailboxId);
		if (threadId) {
			navigate(
				`/m/${nextMailboxId}/threads/${threadId}?folder=${currentFolder}`,
			);
			return;
		}
		navigate(`/m/${nextMailboxId}/${currentFolder}`);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="w-full justify-between gap-2 font-normal"
				>
					<span className="flex min-w-0 items-center gap-2">
						<Mail className="size-4 shrink-0" />
						<span className="truncate">{active.address}</span>
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
				{mailboxes.map((mailbox) => (
					<DropdownMenuItem
						key={mailbox.id}
						onClick={() => mailbox.id && switchMailbox(mailbox.id)}
					>
						{mailbox.address}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
