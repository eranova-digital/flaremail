import { useTranslation } from "react-i18next";

import type { DomainValidationCheck } from "@/lib/api/client";
import { type ValidationCheckKey } from "@/lib/domain-validation";
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
	const { t } = useTranslation("management");
	const key = (check.checkKey ?? "mx") as ValidationCheckKey;
	const postmaster = `postmaster@${domainName}`;
	const noreply = `noreply@${domainName}`;
	const vars = { postmaster, noreply, domainName };
	const tier = check.tier ?? "critical";
	const tierKey = tier === "advisory" ? "advisory" : "required";

	const hint =
		check.status === "passed"
			? t(`domainValidation.checks.${key}.passHint`, vars)
			: check.status === "failed"
				? check.message ?? t(`domainValidation.checks.${key}.failHint`, vars)
				: check.status === "skipped"
					? t("domainValidation.hint.skipped")
					: t("domainValidation.status.pending");

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
						<h3 className="font-medium">
							{t(`domainValidation.checks.${key}.title`)}
						</h3>
						<span className="text-muted-foreground text-xs uppercase tracking-wide">
							{t(`domainValidation.tier.${tierKey}`)}
						</span>
					</div>
					<p className="text-muted-foreground text-sm">
						{t(`domainValidation.checks.${key}.summary`, vars)}
					</p>
				</div>
				<CheckStatusBadge status={check.status} tier={check.tier} />
			</div>

			<p className="text-muted-foreground mt-3 text-sm leading-relaxed">
				{t(`domainValidation.checks.${key}.description`, vars)}
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
				<p className="text-muted-foreground/70 mt-2 font-mono text-[10px] tracking-wide">
					{check.code}
				</p>
			) : null}
			</CardContent>
		</Card>
	);
}
