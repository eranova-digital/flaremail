import type { DomainValidationLogEvent } from "@/lib/api/client";
import { formatValidationTimestamp } from "@/lib/domain-validation";
import { cn } from "@/lib/utils";

export function ValidationLogs({ logs }: { logs: DomainValidationLogEvent[] }) {
	if (!logs.length) {
		return (
			<p className="text-muted-foreground text-sm">No log events for this run yet.</p>
		);
	}

	return (
		<ul className="divide-border divide-y rounded-md border">
			{logs.map((log) => (
				<li key={log.id} className="space-y-1 px-4 py-3 text-sm">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={cn(
								"rounded px-1.5 py-0.5 font-mono text-xs uppercase",
								log.level === "error" && "bg-red-500/10 text-red-900 dark:text-red-100",
								log.level === "warning" &&
									"bg-amber-500/10 text-amber-950 dark:text-amber-100",
								log.level === "info" && "bg-muted text-muted-foreground",
							)}
						>
							{log.level}
						</span>
						<span className="text-muted-foreground font-mono text-xs">
							{log.stage}
						</span>
						<span className="text-muted-foreground ml-auto text-xs">
							{formatValidationTimestamp(log.createdAt)}
						</span>
					</div>
					<p>{log.message}</p>
					{log.code ? (
						<p className="text-muted-foreground font-mono text-xs">{log.code}</p>
					) : null}
				</li>
			))}
		</ul>
	);
}
