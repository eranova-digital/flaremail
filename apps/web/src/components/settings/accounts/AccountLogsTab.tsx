import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, ScrollText } from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { LogSummary } from "@/components/settings/logs/LogSummary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogs } from "@/hooks/use-logs";
import type { AccountDetail } from "@/lib/accounts/api";
import { getErrorMessage } from "@/lib/api/errors";
import type { LogListItem } from "@/lib/logs/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function formatWhen(iso: string): string {
	try {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeStyle: "medium",
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

function importanceVariant(
	importance: number,
): "destructive" | "warning" | "secondary" {
	if (importance <= 2) return "destructive";
	if (importance <= 5) return "warning";
	return "secondary";
}

function LogRow({ item }: { item: LogListItem }) {
	return (
		<li className="hover:bg-muted/40 px-4 py-3 transition-colors">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div className="min-w-0 flex-1 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant={importanceVariant(item.importance)}
							className="font-mono tabular-nums"
							title={`Importance ${item.importance} (0 = most important)`}
						>
							{item.importance}
						</Badge>
						<Badge variant="outline" className="font-medium">
							{item.type}
						</Badge>
					</div>
					<LogSummary summary={item.summary} refs={item.refs} />
				</div>
				<div className="text-muted-foreground flex shrink-0 flex-col gap-0.5 text-xs sm:items-end sm:text-right">
					<time dateTime={item.createdAt}>{formatWhen(item.createdAt)}</time>
					{item.context?.ip ? (
						<span className="font-mono tabular-nums">{item.context.ip}</span>
					) : null}
				</div>
			</div>
		</li>
	);
}

type AccountLogsTabProps = {
	accountId: string;
	invitedBy: AccountDetail["invitedBy"];
};

export function AccountLogsTab({ accountId, invitedBy }: AccountLogsTabProps) {
	const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
		undefined,
	]);
	const [pageIndex, setPageIndex] = useState(0);

	useEffect(() => {
		setCursorStack([undefined]);
		setPageIndex(0);
	}, [accountId]);

	const before = cursorStack[pageIndex];
	const query = useLogs({
		accountId,
		maxImportance: 10,
		limit: PAGE_SIZE,
		before,
	});

	const items = query.data?.items ?? [];
	const nextBefore = query.data?.nextBefore ?? null;
	const hasNext = Boolean(nextBefore);
	const hasPrev = pageIndex > 0;

	const goNext = () => {
		if (!nextBefore) return;
		setCursorStack((stack) => {
			const trimmed = stack.slice(0, pageIndex + 1);
			return [...trimmed, nextBefore];
		});
		setPageIndex((index) => index + 1);
	};

	const goPrev = () => {
		if (pageIndex <= 0) return;
		setPageIndex((index) => index - 1);
	};

	return (
		<div className="space-y-4">
			<div className="bg-muted/30 space-y-3 rounded-lg border p-4">
				<div>
					<p className="text-sm font-medium">Invited by</p>
					<p className="text-muted-foreground text-xs">
						Who created the invite for this account.
					</p>
				</div>
				{invitedBy ? (
					<div
						className={cn(
							"flex items-center gap-3",
							invitedBy.deleted && "opacity-60",
						)}
					>
						<ProfileAvatar
							accountId={invitedBy.id}
							seed={invitedBy.loginIdentifier}
							label={invitedBy.displayName}
							profilePicture={invitedBy.deleted ? null : invitedBy.profilePicture}
							className="size-9 text-xs"
						/>
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">
								{invitedBy.displayName}
							</p>
							<p className="text-muted-foreground truncate text-xs">
								{invitedBy.loginIdentifier}
							</p>
						</div>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">No invite on record.</p>
				)}
			</div>

			<div className="space-y-2">
				<p className="text-sm font-medium">Related logs</p>
				<p className="text-muted-foreground text-xs">
					Logs where this account is the actor or is referenced.
				</p>
			</div>

			{query.isError ? (
				<Alert tone="destructive">
					{getErrorMessage(query.error) ?? "Could not load logs."}
				</Alert>
			) : null}

			{query.isLoading ? (
				<div className="space-y-2 rounded-lg border p-4">
					{Array.from({ length: 4 }, (_, i) => (
						<div key={i} className="space-y-2 py-2">
							<div className="flex gap-2">
								<Skeleton className="h-5 w-8" />
								<Skeleton className="h-5 w-16" />
								<Skeleton className="ml-auto h-4 w-36" />
							</div>
							<Skeleton className="h-4 w-3/4 max-w-md" />
						</div>
					))}
				</div>
			) : null}

			{!query.isLoading && !query.isError && items.length === 0 ? (
				<div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
					<ScrollText className="size-7 opacity-40" aria-hidden />
					<p className="text-foreground text-sm font-medium">No related logs</p>
					<p className="max-w-sm text-xs">
						Nothing in retention mentions this account yet.
					</p>
				</div>
			) : null}

			{items.length > 0 ? (
				<div
					className={cn(
						"overflow-hidden rounded-lg border",
						query.isFetching && !query.isLoading && "opacity-80",
					)}
				>
					<ul className="divide-border divide-y">
						{items.map((item) => (
							<LogRow key={item.id} item={item} />
						))}
					</ul>
					{(hasPrev || hasNext) && (
						<div className="bg-muted/30 flex items-center justify-between border-t px-4 py-2.5">
							<p className="text-muted-foreground text-xs">
								Page {pageIndex + 1}
								{hasNext ? " · more available" : " · end of results"}
							</p>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!hasPrev || query.isFetching}
									onClick={goPrev}
									className="gap-1"
								>
									<ChevronLeft className="size-4" />
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!hasNext || query.isFetching}
									onClick={goNext}
									className="gap-1"
								>
									{query.isFetching && !query.isLoading ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<>
											Next
											<ChevronRight className="size-4" />
										</>
									)}
								</Button>
							</div>
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}
