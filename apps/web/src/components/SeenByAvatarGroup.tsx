import { ProfileAvatar } from "@/components/ProfileAvatar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SeenByViewer } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

function viewerDisplayName(viewer: SeenByViewer): string {
	return (
		viewer.displayName?.trim() ||
		viewer.loginIdentifier ||
		viewer.accountId ||
		"(unknown)"
	);
}

export function SeenByAvatarGroup({
	seenBy,
	className,
}: {
	seenBy: SeenByViewer[] | null | undefined;
	className?: string;
}) {
	const list = seenBy ?? [];
	if (list.length === 0) {
		return null;
	}

	const maxVisible = list.length > 5 ? 4 : list.length;
	const visible = list.slice(0, maxVisible);
	const extra = list.length > 5 ? list.length - 4 : 0;

	return (
		<div className={cn("flex shrink-0 items-center gap-1.5", className)}>
			<span className="text-muted-foreground shrink-0 text-[10px]">Seen by</span>
			<div className="flex items-center -space-x-2">
				{visible.map((viewer) => (
					<Tooltip key={viewer.accountId}>
						<TooltipTrigger asChild>
							<span className="ring-background inline-flex rounded-full ring-2">
								<ProfileAvatar
									accountId={viewer.accountId ?? ""}
									seed={viewer.loginIdentifier ?? viewer.accountId ?? ""}
									label={viewerDisplayName(viewer)}
									profilePicture={viewer.profilePicture}
									className="size-5 text-[10px]"
								/>
							</span>
						</TooltipTrigger>
						<TooltipContent>{viewerDisplayName(viewer)}</TooltipContent>
					</Tooltip>
				))}

				{extra > 0 ? (
					<span className="ring-background bg-muted text-muted-foreground inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ring-2">
						+{extra}
					</span>
				) : null}
			</div>
		</div>
	);
}

