import { ChevronDown, Mail, ShieldCheck } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useDomains } from "@/hooks/use-domains";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { setLastMailboxId } from "@/lib/mailbox-preference";
import { isThreadFolder } from "@/lib/folders";
import { cn } from "@/lib/utils";
import type { Mailbox, ThreadFolder } from "@/lib/api/client";
import {
	getSelectableMailboxes,
	resolveSelectableMailbox,
} from "@/lib/selectable-mailbox";
import { groupMailboxesByDomain } from "@/lib/sort-mailboxes";

function isSystemMailbox(mailbox: Mailbox): boolean {
	return (
		mailbox.isSystemManaged ??
		(mailbox.type === "system" || mailbox.type === "blackhole")
	);
}

function MailboxOptionLabel({ mailbox }: { mailbox: Mailbox }) {
	const isSystem = isSystemMailbox(mailbox);

	return (
		<span
			className={cn(
				"flex min-w-0 flex-1 items-center gap-2",
				isSystem && "text-muted-foreground",
			)}
		>
			<span className="truncate">{mailbox.address}</span>
			{isSystem ? (
				<Badge
					variant="secondary"
					className="ml-auto shrink-0 px-1.5 py-0 text-[10px] font-medium"
				>
					System
				</Badge>
			) : null}
		</span>
	);
}

export function MailboxSwitcher() {
	const navigate = useNavigate();
	const { mailboxId, folder: folderParam, threadId } = useParams();
	const [searchParams] = useSearchParams();
	const mailboxesQuery = useMailboxes();
	const domainsQuery = useDomains();

	const currentFolder: ThreadFolder =
		folderParam && isThreadFolder(folderParam)
			? folderParam
			: isThreadFolder(searchParams.get("folder") ?? "")
				? (searchParams.get("folder") as ThreadFolder)
				: "inbox";

	if (mailboxesQuery.isLoading || domainsQuery.isLoading) {
		return <Skeleton className="h-9 w-full" />;
	}

	const mailboxes = getSelectableMailboxes(mailboxesQuery.data ?? []);
	const domainNamesById = new Map(
		(domainsQuery.data ?? []).flatMap((domain) =>
			domain.id && domain.domain ? [[domain.id, domain.domain] as const] : [],
		),
	);
	const shouldGroupByDomain =
		new Set(mailboxes.map((mailbox) => mailbox.domainId).filter(Boolean)).size > 1;
	const mailboxGroups = shouldGroupByDomain
		? groupMailboxesByDomain(mailboxes, domainNamesById)
		: null;
	const active = resolveSelectableMailbox(mailboxes, mailboxId ?? null);

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

	const activeIsSystem = isSystemMailbox(active);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="w-full justify-between gap-2 font-normal"
				>
					<span className="flex min-w-0 items-center gap-2">
						{activeIsSystem ? (
							<ShieldCheck className="size-4 shrink-0" />
						) : (
							<Mail className="size-4 shrink-0" />
						)}
						<span className="truncate">{active.address}</span>
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
				{mailboxGroups ? (
					mailboxGroups.map((group, groupIndex) => (
						<DropdownMenuGroup key={group.domainName}>
							{groupIndex > 0 ? <DropdownMenuSeparator /> : null}
							<DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
								{group.domainName}
							</DropdownMenuLabel>
							{group.mailboxes.map((mailbox) => (
								<DropdownMenuItem
									key={mailbox.id}
									onClick={() => mailbox.id && switchMailbox(mailbox.id)}
								>
									<MailboxOptionLabel mailbox={mailbox} />
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					))
				) : (
					mailboxes.map((mailbox) => (
						<DropdownMenuItem
							key={mailbox.id}
							onClick={() => mailbox.id && switchMailbox(mailbox.id)}
						>
							<MailboxOptionLabel mailbox={mailbox} />
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
