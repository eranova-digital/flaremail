import { useEffect, useMemo, useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	RefreshCw,
	ScrollText,
} from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { LogSummary } from "@/components/settings/logs/LogSummary";
import { DateTimeRangePicker } from "@/components/settings/logs/DateTimeRangePicker";
import { LogTypeMultiSelect } from "@/components/settings/logs/LogTypeMultiSelect";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogs } from "@/hooks/use-logs";
import type { AccountDetail } from "@/lib/accounts/api";
import { getErrorMessage } from "@/lib/api/errors";
import type { LogListItem, LogType } from "@/lib/logs/api";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [25, 50, 100] as const;

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
						{item.context?.method && item.context?.path ? (
							<span
								className="text-muted-foreground hidden max-w-[12rem] truncate font-mono text-[11px] sm:inline"
								title={`${item.context.method} ${item.context.path}`}
							>
								{item.context.method} {item.context.path}
							</span>
						) : null}
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
	const [searchDraft, setSearchDraft] = useState("");
	const [q, setQ] = useState("");
	const [maxImportance, setMaxImportance] = useState(5);
	const [types, setTypes] = useState<LogType[]>([]);
	const [dateRange, setDateRange] = useState<
		{ from?: Date; to?: Date } | undefined
	>(undefined);
	const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(25);
	const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
		undefined,
	]);
	const [pageIndex, setPageIndex] = useState(0);

	useEffect(() => {
		const handle = window.setTimeout(() => {
			setQ(searchDraft.trim());
		}, 300);
		return () => window.clearTimeout(handle);
	}, [searchDraft]);

	const filterKey = useMemo(
		() =>
			JSON.stringify({
				accountId,
				q,
				maxImportance,
				types,
				from: dateRange?.from?.toISOString() ?? null,
				to: dateRange?.to?.toISOString() ?? null,
				limit,
			}),
		[accountId, q, maxImportance, types, dateRange, limit],
	);

	useEffect(() => {
		setCursorStack([undefined]);
		setPageIndex(0);
	}, [filterKey]);

	const before = cursorStack[pageIndex];
	const query = useLogs({
		accountId,
		q: q || undefined,
		types: types.length > 0 ? types : undefined,
		maxImportance,
		from: dateRange?.from?.toISOString(),
		to: dateRange?.to?.toISOString(),
		limit,
		before,
	});

	const items = query.data?.items ?? [];
	const nextBefore = query.data?.nextBefore ?? null;
	const hasNext = Boolean(nextBefore);
	const hasPrev = pageIndex > 0;
	const pageNumber = pageIndex + 1;

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

			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-0.5">
					<p className="text-sm font-medium">Related logs</p>
					<p className="text-muted-foreground text-xs">
						Logs where this account is the actor or is referenced.
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{query.data ? (
						<Badge variant="secondary">
							{items.length}
							{hasNext ? "+" : ""} on this page
						</Badge>
					) : null}
					<Button
						variant="outline"
						size="sm"
						className="gap-2"
						aria-label="Refresh logs"
						disabled={query.isFetching}
						onClick={() => void query.refetch()}
					>
						<RefreshCw
							className={cn("size-3.5", query.isFetching && "animate-spin")}
						/>
						Refresh
					</Button>
				</div>
			</div>

			<div className="space-y-3 rounded-lg border p-4">
				<div className="space-y-1">
					<label
						className="text-muted-foreground text-xs"
						htmlFor="account-logs-q"
					>
						Search
					</label>
					<Input
						id="account-logs-q"
						value={searchDraft}
						placeholder="Search summary, refs, context…"
						onChange={(event) => setSearchDraft(event.target.value)}
					/>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="space-y-1">
						<label
							className="text-muted-foreground text-xs"
							htmlFor="account-logs-importance"
						>
							Max importance
						</label>
						<Select
							value={String(maxImportance)}
							onValueChange={(value) => setMaxImportance(Number(value))}
						>
							<SelectTrigger id="account-logs-importance">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Array.from({ length: 11 }, (_, i) => (
									<SelectItem key={i} value={String(i)}>
										≤ {i}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1">
						<label
							className="text-muted-foreground text-xs"
							htmlFor="account-logs-type"
						>
							Type
						</label>
						<LogTypeMultiSelect
							id="account-logs-type"
							value={types}
							onChange={setTypes}
						/>
					</div>
					<div className="space-y-1 sm:col-span-2">
						<label
							className="text-muted-foreground text-xs"
							htmlFor="account-logs-range"
						>
							Date & time range
						</label>
						<DateTimeRangePicker
							id="account-logs-range"
							value={dateRange}
							onChange={setDateRange}
						/>
					</div>
				</div>
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
					<p className="text-foreground text-sm font-medium">No logs found</p>
					<p className="max-w-sm text-xs">
						Try widening max importance, clearing the date range, or choosing
						another type.
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

					<div className="bg-muted/30 flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex flex-wrap items-center gap-3">
							<p className="text-muted-foreground text-xs">
								Page {pageNumber}
								{hasNext ? " · more available" : " · end of results"}
							</p>
							<div className="flex items-center gap-2">
								<label
									className="text-muted-foreground text-xs"
									htmlFor="account-logs-limit"
								>
									Page size
								</label>
								<Select
									value={String(limit)}
									onValueChange={(value) =>
										setLimit(Number(value) as (typeof PAGE_SIZES)[number])
									}
								>
									<SelectTrigger
										id="account-logs-limit"
										className="h-8 w-[7.5rem]"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZES.map((size) => (
											<SelectItem key={size} value={String(size)}>
												{size} / page
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
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
				</div>
			) : null}
		</div>
	);
}
