import type { DomainValidationCheck } from "@/lib/api/client";
import {
	getValidationCheckMeta,
	type ValidationCheckKey,
} from "@/lib/domain-validation";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { CheckStatusBadge } from "./CheckStatusBadge";

export function ValidationCheckCard({
	check,
	domainName,
}: {
	check: DomainValidationCheck;
	domainName: string;
}) {
	const key = (check.checkKey ?? "mx") as ValidationCheckKey;
	const meta = getValidationCheckMeta(key, domainName);
	const hint =
		check.status === "passed"
			? meta.passHint
			: check.status === "failed"
				? check.message ?? meta.failHint
				: check.status === "skipped"
					? "Skipped because an earlier critical check failed."
					: "Waiting for this step to run.";

	return (
		<Card
			className={cn(
				"gap-0 rounded-lg py-0",
				check.status === "failed" && check.tier === "critical" && "border-foreground/20",
				check.status === "failed" && check.tier === "advisory" && "border-muted-foreground/30",
			)}
		>
			<CardContent className="space-y-0 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-medium">{meta.title}</h3>
						<span className="text-muted-foreground text-xs uppercase tracking-wide">
							{meta.tier === "critical" ? "Required" : "Advisory"}
						</span>
					</div>
					<p className="text-muted-foreground text-sm">{meta.summary}</p>
				</div>
				<CheckStatusBadge status={check.status} tier={check.tier} />
			</div>

			<p className="text-muted-foreground mt-3 text-sm leading-relaxed">
				{meta.description}
			</p>

			<p
				className={cn(
					"mt-3 rounded-md px-3 py-2 text-sm",
					check.status === "passed" && "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
					check.status === "failed" && check.tier === "critical" &&
						"bg-red-500/10 text-red-900 dark:text-red-100",
					check.status === "failed" && check.tier === "advisory" &&
						"bg-amber-500/10 text-amber-950 dark:text-amber-100",
					(check.status === "pending" || check.status === "skipped") &&
						"bg-muted text-muted-foreground",
				)}
			>
				{hint}
			</p>

			{check.code ? (
				<p className="text-muted-foreground mt-2 font-mono text-xs">{check.code}</p>
			) : null}
			</CardContent>
		</Card>
	);
}
