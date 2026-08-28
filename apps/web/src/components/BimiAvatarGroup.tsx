import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { BimiAvatar } from "@/components/BimiAvatar";
import { cn } from "@/lib/utils";

type BimiAvatarGroupProps = {
	domains: string[] | null | undefined;
	className?: string;
	size?: "sm" | "md";
};

export function BimiAvatarGroup({
	domains,
	className,
	size = "md",
}: BimiAvatarGroupProps) {
	const list = domains ?? [];
	if (list.length === 0) {
		return null;
	}

	const maxVisible = list.length > 5 ? 4 : list.length;
	const visible = list.slice(0, maxVisible);
	const extra = list.length > 5 ? list.length - 4 : 0;
	const avatarClassName = size === "sm" ? "size-4" : "size-5";
	const overflowClassName =
		size === "sm" ? "size-4 text-[8px]" : "size-5 text-[10px]";

	return (
		<div className={cn("flex shrink-0 items-center", className)}>
			<div className="flex items-center -space-x-2">
				{visible.map((domain) => (
					<Tooltip key={domain}>
						<TooltipTrigger asChild>
							<span className="ring-background inline-flex rounded-full ring-2">
								<BimiAvatar domain={domain} className={avatarClassName} />
							</span>
						</TooltipTrigger>
						<TooltipContent>{domain}</TooltipContent>
					</Tooltip>
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
	);
}
