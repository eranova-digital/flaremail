import { Flame, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type PageLoaderProps = {
	/** Optional short label describing what is loading. */
	label?: string;
	className?: string;
};

/**
 * Full-page loading state that keeps brand context on screen instead of an
 * anonymous skeleton. Used while auth/session state resolves.
 */
export function PageLoader({ label = "Loading…", className }: PageLoaderProps) {
	return (
		<div
			className={cn(
				"bg-background flex min-h-svh flex-col items-center justify-center gap-4 p-8",
				className,
			)}
		>
			<div className="flex items-center gap-2.5">
				<span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
					<Flame className="size-4.5" aria-hidden />
				</span>
				<span className="text-lg font-semibold tracking-tight">Flaremail</span>
			</div>
			<div
				className="text-muted-foreground flex items-center gap-2 text-sm"
				role="status"
			>
				<Loader2 className="size-4 animate-spin" aria-hidden />
				{label}
			</div>
		</div>
	);
}
