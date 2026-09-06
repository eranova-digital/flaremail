import { useTranslation } from "react-i18next";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SeenByViewer } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

function viewerDisplayName(
	viewer: SeenByViewer,
	unknownLabel: string,
): string {
	return (
		viewer.displayName?.trim() ||
		viewer.loginIdentifier ||
		viewer.accountId ||
		unknownLabel
	);
}

export function SeenByAvatarGroup({
	seenBy,
	className,
	size = "md",
	showLabel = false,
}: {
	seenBy: SeenByViewer[] | null | undefined;
	className?: string;
	size?: "sm" | "md";
	showLabel?: boolean;
}) {
	const { t, i18n } = useTranslation("mail");
	const unknownLabel = t("threadList.unknown");
	const list = seenBy ?? [];
	if (list.length === 0) {
		return null;
	}

	const maxVisible = list.length > 5 ? 4 : list.length;
	const visible = list.slice(0, maxVisible);
	const extra = list.length > 5 ? list.length - 4 : 0;
	const avatarClassName = size === "sm" ? "size-4 text-[8px]" : "size-5 text-[10px]";
	const labelClassName = size === "sm" ? "text-[9px]" : "text-[10px]";
	const overflowClassName = size === "sm" ? "size-4 text-[8px]" : "size-5 text-[10px]";
	const names = list.map((viewer) => viewerDisplayName(viewer, unknownLabel)).join(", ");
	const latestSeenAt = list.reduce<string | undefined>((latest, viewer) => {
		if (!viewer.seenAt) {
			return latest;
		}
		if (!latest || viewer.seenAt > latest) {
			return viewer.seenAt;
		}
		return latest;
	}, undefined);
	const latestTime = latestSeenAt
		? new Date(latestSeenAt).toLocaleTimeString(i18n.language, {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;
	const groupLabel = latestTime
		? `${t("seenBy")} ${names} · ${latestTime}`
		: `${t("seenBy")} ${names}`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					role="group"
					tabIndex={0}
					aria-label={groupLabel}
					className={cn("flex shrink-0 items-center", showLabel && "gap-1.5", className)}
				>
					{showLabel ? (
						<span className={cn("text-muted-foreground shrink-0", labelClassName)}>
							{t("seenBy")}
						</span>
					) : null}
					<div className="flex items-center -space-x-2">
						{visible.map((viewer) => (
							<span
								key={viewer.accountId}
								className="ring-background inline-flex rounded-full ring-2"
							>
								<ProfileAvatar
									accountId={viewer.accountId ?? ""}
									seed={viewer.loginIdentifier ?? viewer.accountId ?? ""}
									label={viewerDisplayName(viewer, unknownLabel)}
									profilePicture={viewer.profilePicture}
									className={avatarClassName}
								/>
							</span>
						))}

						{extra > 0 ? (
							<span
								className={cn(
									"ring-background bg-muted text-muted-foreground inline-flex items-center justify-center rounded-full font-semibold ring-2",
									overflowClassName,
								)}
							>
								+{extra}
							</span>
						) : null}
					</div>
				</div>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">{groupLabel}</TooltipContent>
		</Tooltip>
	);
}
