import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	RefreshCw,
	ScrollText,
} from "lucide-react";

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
import { getErrorMessage } from "@/lib/api/errors";
import { LOG_TYPES, type LogListItem, type LogType } from "@/lib/logs/api";
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
	const { t } = useTranslation("management");

	return (
		<li className="hover:bg-muted/40 px-4 py-3.5 transition-colors sm:px-5">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant={importanceVariant(item.importance)}
							className="font-mono tabular-nums"
							title={t("logs.importanceTitle", { n: item.importance })}
						>
							{item.importance}
						</Badge>
						<Badge variant="outline" className="font-medium">
							{item.type}
						</Badge>
						{item.context?.method && item.context?.path ? (
							<span
								className="text-muted-foreground hidden max-w-[14rem] truncate font-mono text-[11px] lg:inline"
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

export function LogsSection() {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const [searchParams, setSearchParams] = useSearchParams();

	const qParam = searchParams.get("q") ?? "";
	const [searchDraft, setSearchDraft] = useState(qParam);
	const maxImportance = Number(searchParams.get("maxImportance") ?? "5");
	const typeParam = searchParams.get("type");
	const from = searchParams.get("from") ?? "";
	const to = searchParams.get("to") ?? "";
	const limitRaw = Number(searchParams.get("limit") ?? "25");
	const limit = (PAGE_SIZES as readonly number[]).includes(limitRaw)
		? limitRaw
		: 25;

	const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
		undefined,
	]);
	const [pageIndex, setPageIndex] = useState(0);

	useEffect(() => {
		setSearchDraft(qParam);
	}, [qParam]);

	useEffect(() => {
		const handle = window.setTimeout(() => {
			if (searchDraft === qParam) return;
			setSearchParams(
				(current) => {
					const next = new URLSearchParams(current);
					next.set("tab", "logs");
					const trimmed = searchDraft.trim();
					if (!trimmed) {
						next.delete("q");
					} else {
						next.set("q", trimmed);
					}
					return next;
				},
				{ replace: true },
			);
		}, 300);
		return () => window.clearTimeout(handle);
	}, [searchDraft, qParam, setSearchParams]);

	const filterKey = useMemo(
		() =>
			JSON.stringify({
				q: qParam.trim(),
				maxImportance,
				type: typeParam,
				from,
				to,
				limit,
			}),
		[qParam, maxImportance, typeParam, from, to, limit],
	);

	useEffect(() => {
		setCursorStack([undefined]);
		setPageIndex(0);
	}, [filterKey]);

	const types = useMemo(() => {
		if (!typeParam || typeParam === "all") return [];
		return typeParam.split(",").filter((t): t is LogType =>
			(LOG_TYPES as readonly string[]).includes(t),
		);
	}, [typeParam]);

	const dateRange = useMemo(() => {
		const fromDate = from ? new Date(from) : undefined;
		const toDate = to ? new Date(to) : undefined;
		if (
			(fromDate && Number.isNaN(fromDate.getTime())) ||
			(toDate && Number.isNaN(toDate.getTime()))
		) {
			return undefined;
		}
		if (!fromDate && !toDate) return undefined;
		return { from: fromDate, to: toDate };
	}, [from, to]);

	const before = cursorStack[pageIndex];

	const query = useLogs({
		q: qParam.trim() || undefined,
		types: types.length > 0 ? types : undefined,
		maxImportance: Number.isInteger(maxImportance) ? maxImportance : 5,
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

	const setFilter = (key: string, value: string | null) => {
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("tab", "logs");
				if (value === null || value === "") {
					next.delete(key);
				} else {
					next.set(key, value);
				}
				return next;
			},
			{ replace: true },
		);
	};

	const setTypes = (nextTypes: LogType[]) => {
		setFilter("type", nextTypes.length > 0 ? nextTypes.join(",") : null);
	};

	const setDateRange = (
		range: { from?: Date; to?: Date } | undefined,
	) => {
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("tab", "logs");
				if (range?.from) {
					next.set("from", range.from.toISOString());
				} else {
					next.delete("from");
				}
				if (range?.to) {
					next.set("to", range.to.toISOString());
				} else {
					next.delete("to");
				}
				return next;
			},
			{ replace: true },
		);
	};

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
		<section className="space-y-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 space-y-1">
					<h2 className="text-lg font-medium">{t("logs.title")}</h2>
					<p className="text-muted-foreground text-sm">
						{t("logs.description")}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{query.data ? (
						<Badge variant="secondary">
							{hasNext
								? t("logs.pageCountMore", { count: items.length })
								: t("logs.pageCount", { count: items.length })}
						</Badge>
					) : null}
					<Button
						variant="outline"
						size="sm"
						className="gap-2"
						aria-label={t("logs.refreshAria")}
						disabled={query.isFetching}
						onClick={() => void query.refetch()}
					>
						<RefreshCw
							className={cn("size-3.5", query.isFetching && "animate-spin")}
						/>
						{t("logs.refresh")}
					</Button>
				</div>
			</div>

			<div className="bg-card space-y-3 rounded-xl border p-4 shadow-sm">
				<div className="space-y-1">
					<label className="text-muted-foreground text-xs" htmlFor="logs-q">
						{tc("search")}
					</label>
					<Input
						id="logs-q"
						value={searchDraft}
						placeholder={t("logs.searchPlaceholder")}
						onChange={(event) => setSearchDraft(event.target.value)}
					/>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					<div className="space-y-1">
						<label
							className="text-muted-foreground text-xs"
							htmlFor="logs-importance"
						>
							{t("logs.maxImportance")}
						</label>
						<Select
							value={String(Number.isInteger(maxImportance) ? maxImportance : 5)}
							onValueChange={(value) => setFilter("maxImportance", value)}
						>
							<SelectTrigger id="logs-importance">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Array.from({ length: 11 }, (_, i) => (
									<SelectItem key={i} value={String(i)}>
										{t("logs.maxImportanceOption", { n: i })}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1">
						<label className="text-muted-foreground text-xs" htmlFor="logs-type">
							{t("logs.type")}
						</label>
						<LogTypeMultiSelect
							id="logs-type"
							value={types}
							onChange={setTypes}
						/>
					</div>
					<div className="space-y-1 sm:col-span-2 xl:col-span-1">
						<label
							className="text-muted-foreground text-xs"
							htmlFor="logs-range"
						>
							{t("logs.dateRangeLabel")}
						</label>
						<DateTimeRangePicker
							id="logs-range"
							value={dateRange}
							onChange={setDateRange}
						/>
					</div>
				</div>
			</div>

			{query.isError ? (
				<Alert tone="destructive">
					{getErrorMessage(query.error) ?? t("logs.loadError")}
				</Alert>
			) : null}

			{query.isLoading ? (
				<div className="space-y-2 rounded-xl border p-4">
					{Array.from({ length: 5 }, (_, i) => (
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
				<div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
					<ScrollText className="size-8 opacity-40" aria-hidden />
					<p className="text-sm font-medium text-foreground">
						{t("logs.emptyTitle")}
					</p>
					<p className="max-w-sm text-xs">{t("logs.emptyHint")}</p>
				</div>
			) : null}

			{items.length > 0 ? (
				<div
					className={cn(
						"overflow-hidden rounded-xl border bg-card shadow-sm",
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
								{t("logs.page", { n: pageNumber })}
								{hasNext
									? t("logs.moreAvailable")
									: t("logs.endOfResults")}
							</p>
							<div className="flex items-center gap-2">
								<label
									className="text-muted-foreground text-xs"
									htmlFor="logs-limit"
								>
									{t("logs.pageSize")}
								</label>
								<Select
									value={String(limit)}
									onValueChange={(value) => setFilter("limit", value)}
								>
									<SelectTrigger id="logs-limit" className="h-8 w-[7.5rem]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZES.map((size) => (
											<SelectItem key={size} value={String(size)}>
												{t("logs.perPage", { n: size })}
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
								{t("logs.previous")}
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
										{tc("next")}
										<ChevronRight className="size-4" />
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}
