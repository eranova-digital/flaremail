import { useTranslation } from "react-i18next";

import type { DomainValidationRunSummary } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatValidationTimestamp } from "@/lib/domain-validation";
import { cn } from "@/lib/utils";

import { ReadinessBadge } from "./ReadinessBadge";

export function ValidationRunHistory({
	runs,
	selectedRunId,
	onSelect,
}: {
	runs: DomainValidationRunSummary[];
	selectedRunId: string | null;
	onSelect: (runId: string) => void;
}) {
	const { t } = useTranslation("management");

	if (!runs.length) {
		return (
			<p className="text-muted-foreground text-sm">
				{t("domainValidation.history.empty")}
			</p>
		);
	}

	return (
		<Card className="gap-0 rounded-md py-0">
			<CardContent className="p-0">
				<ul className="divide-border divide-y">
			{runs.map((run) => {
				if (!run.id) {
					return null;
				}

				const isSelected = run.id === selectedRunId;
				const badge = run.badge;

				return (
					<li key={run.id}>
						<button
							type="button"
							onClick={() => onSelect(run.id!)}
							className={cn(
								"hover:bg-muted/50 flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors",
								isSelected && "bg-muted/60",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-medium">
									{formatValidationTimestamp(run.startedAt)}
								</span>
								{badge ? (
									<ReadinessBadge readiness={{ badge }} />
								) : null}
							</div>
							<p className="text-muted-foreground text-xs">
								{run.status === "checking"
									? t("domainValidation.history.inProgress")
									: run.status === "cancelled"
										? t("domainValidation.history.cancelled")
										: badge
											? t(`domainValidation.badges.${badge}.headline`)
											: t("domainValidation.history.completed")}
							</p>
						</button>
					</li>
				);
			})}
				</ul>
			</CardContent>
		</Card>
	);
}
