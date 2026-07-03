import { Star } from "lucide-react";

import type { Label, Thread } from "@/lib/api/client";
import { DEFAULT_LABEL_COLOR } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

function formatWhen(value?: string | null): string {
	if (!value) {
		return "";
	}

	return new Date(value).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

type ThreadListItemProps = {
	thread: Thread;
	selected: boolean;
	labels?: Label[];
	onSelect: () => void;
};

export function ThreadListItem({
	thread,
	selected,
	labels = [],
	onSelect,
}: ThreadListItemProps) {
	const displayName =
		thread.participants?.join(", ") || thread.sender || "(unknown)";
	const threadLabels = (thread.labelIds ?? [])
		.map((id) => labels.find((label) => label.id === id))
		.filter((label): label is Label => Boolean(label));

	return (
		<li>
			<button
				type="button"
				onClick={onSelect}
				className={cn(
					"hover:bg-accent/60 group w-full cursor-pointer border-b px-4 py-3 text-left transition-colors",
					selected && "bg-accent",
					!thread.isRead && "border-l-primary border-l-3 font-semibold",
					thread.isStarred && "border-l-amber-500 border-l-3",
					thread.isStarred && thread.isRead && "border-l-amber-200 border-l-3",
				)}
			>
				<div className="flex items-start justify-between gap-2">
					<p className="text-muted-foreground truncate text-xs">{displayName}</p>
					<div className="flex shrink-0 items-center gap-1">
						{thread.isStarred ? (
							<Star className="size-3.5 fill-current text-amber-500" />
						) : null}
						<span className="text-muted-foreground text-xs whitespace-nowrap">
							{formatWhen(thread.lastMessageAt)}
						</span>
					</div>
				</div>
				<p className="mt-1 truncate text-sm">{thread.subject || "(no subject)"}</p>
				{threadLabels.length > 0 ? (
					<div className="mt-1.5 flex flex-wrap gap-1">
						{threadLabels.map((label) => (
							<span
								key={label.id}
								className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]"
							>
								<span
									className="size-1.5 rounded-full"
									style={{
										backgroundColor: label.color ?? DEFAULT_LABEL_COLOR,
									}}
								/>
								{label.name}
							</span>
						))}
					</div>
				) : null}
				<p className="text-muted-foreground mt-1 h-0 origin-top scale-y-0 transform truncate text-xs blur-xs transition-all duration-300 ease-in-out group-hover:h-4 group-hover:scale-y-100 group-hover:blur-none">
					{thread.preview || "No preview"}
				</p>
			</button>
		</li>
	);
}
