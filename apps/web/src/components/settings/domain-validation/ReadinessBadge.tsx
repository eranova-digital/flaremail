import { Badge } from "@/components/ui/badge";
import type { DomainReadinessSummary } from "@/lib/api/client";
import { BADGE_META, type ReadinessBadge as ReadinessBadgeValue } from "@/lib/domain-validation";
import { cn } from "@/lib/utils";

const BADGE_STYLES: Record<ReadinessBadgeValue, { dot: string; text: string }> = {
	checking: {
		dot: "bg-blue-500",
		text: "text-blue-700 dark:text-blue-300",
	},
	healthy: {
		dot: "bg-emerald-500",
		text: "text-emerald-700 dark:text-emerald-300",
	},
	unhealthy: {
		dot: "bg-amber-500",
		text: "text-amber-700 dark:text-amber-300",
	},
	fail: {
		dot: "bg-red-500",
		text: "text-red-700 dark:text-red-300",
	},
};

export function ReadinessBadge({
	readiness,
}: {
	readiness?: DomainReadinessSummary;
}) {
	const badge = readiness?.badge;
	if (!badge) {
		return null;
	}

	const style = BADGE_STYLES[badge];

	return (
		<Badge variant="outline" className={cn("gap-1.5", style.text)}>
			<span
				className={cn(
					"size-1.5 rounded-full",
					style.dot,
					badge === "checking" && "animate-pulse",
				)}
			/>
			{BADGE_META[badge].label}
		</Badge>
	);
}
