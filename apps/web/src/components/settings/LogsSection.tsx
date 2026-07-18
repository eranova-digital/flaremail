import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { LogSummary } from "@/components/settings/logs/LogSummary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useLogs } from "@/hooks/use-logs";
import { getErrorMessage } from "@/lib/api/errors";
import { LOG_TYPES, type LogType } from "@/lib/logs/api";
import { cn } from "@/lib/utils";

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

export function LogsSection() {
	const [searchParams, setSearchParams] = useSearchParams();

	const q = searchParams.get("q") ?? "";
	const maxImportance = Number(searchParams.get("maxImportance") ?? "5");
	const typeParam = searchParams.get("type");
	const from = searchParams.get("from") ?? "";
	const to = searchParams.get("to") ?? "";

	const types = useMemo(() => {
		if (!typeParam || typeParam === "all") return undefined;
		return typeParam.split(",").filter((t): t is LogType =>
			(LOG_TYPES as readonly string[]).includes(t),
		);
	}, [typeParam]);

	const query = useLogs({
		q: q.trim() || undefined,
		types,
		maxImportance: Number.isInteger(maxImportance) ? maxImportance : 5,
		from: from ? new Date(from).toISOString() : undefined,
		to: to ? new Date(to).toISOString() : undefined,
	});

	const items = query.data?.pages.flatMap((page) => page.items) ?? [];

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

	return (
		<section className="space-y-6">
			<div>
				<h2 className="text-lg font-medium">Logs</h2>
				<p className="text-muted-foreground text-sm">
					Instance activity for the intendant and superadmins. Default filter
					shows importance 0–5.
				</p>
			</div>

			<div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
				<div className="min-w-[12rem] flex-1 space-y-1">
					<label className="text-muted-foreground text-xs" htmlFor="logs-q">
						Search
					</label>
					<Input
						id="logs-q"
						value={q}
						placeholder="Search summary, refs, context…"
						onChange={(event) => setFilter("q", event.target.value)}
					/>
				</div>
				<div className="w-full space-y-1 sm:w-40">
					<label className="text-muted-foreground text-xs" htmlFor="logs-importance">
						Max importance
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
									≤ {i}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="w-full space-y-1 sm:w-44">
					<label className="text-muted-foreground text-xs" htmlFor="logs-type">
						Type
					</label>
					<Select
						value={typeParam || "all"}
						onValueChange={(value) =>
							setFilter("type", value === "all" ? null : value)
						}
					>
						<SelectTrigger id="logs-type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All types</SelectItem>
							{LOG_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{type}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="w-full space-y-1 sm:w-52">
					<label className="text-muted-foreground text-xs" htmlFor="logs-from">
						From
					</label>
					<Input
						id="logs-from"
						type="datetime-local"
						value={from}
						onChange={(event) => setFilter("from", event.target.value || null)}
					/>
				</div>
				<div className="w-full space-y-1 sm:w-52">
					<label className="text-muted-foreground text-xs" htmlFor="logs-to">
						To
					</label>
					<Input
						id="logs-to"
						type="datetime-local"
						value={to}
						onChange={(event) => setFilter("to", event.target.value || null)}
					/>
				</div>
			</div>

			{query.isLoading ? (
				<div className="text-muted-foreground flex items-center gap-2 text-sm">
					<Loader2 className="size-4 animate-spin" aria-hidden />
					Loading logs…
				</div>
			) : null}

			{query.isError ? (
				<Alert tone="destructive">
					{getErrorMessage(query.error) ?? "Could not load logs."}
				</Alert>
			) : null}

			{!query.isLoading && !query.isError && items.length === 0 ? (
				<p className="text-muted-foreground text-sm">No logs match these filters.</p>
			) : null}

			<ul className="divide-border divide-y rounded-xl border">
				{items.map((item) => (
					<li key={item.id} className="space-y-2 px-4 py-3">
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<span
								className={cn(
									"rounded-md px-1.5 py-0.5 font-mono font-medium",
									item.importance <= 2
										? "bg-destructive/15 text-destructive"
										: item.importance <= 5
											? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
											: "bg-muted text-muted-foreground",
								)}
							>
								{item.importance}
							</span>
							<span className="bg-muted rounded-md px-1.5 py-0.5 font-medium">
								{item.type}
							</span>
							<span className="text-muted-foreground">
								{formatWhen(item.createdAt)}
							</span>
							{item.context?.ip ? (
								<span className="text-muted-foreground font-mono">
									{item.context.ip}
								</span>
							) : null}
						</div>
						<LogSummary summary={item.summary} refs={item.refs} />
					</li>
				))}
			</ul>

			{query.hasNextPage ? (
				<div className="flex justify-center">
					<Button
						variant="outline"
						disabled={query.isFetchingNextPage}
						onClick={() => void query.fetchNextPage()}
					>
						{query.isFetchingNextPage ? "Loading…" : "Load more"}
					</Button>
				</div>
			) : null}
		</section>
	);
}
