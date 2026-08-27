import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Label, Thread } from "@/lib/api/client";
import { SeenByAvatarGroup } from "@/components/SeenByAvatarGroup";
import { DEFAULT_LABEL_COLOR } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

function formatWhen(value: string | null | undefined, locale: string): string {
	if (!value) {
		return "";
	}

	return new Date(value).toLocaleString(locale, {
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
	const { t, i18n } = useTranslation("mail");
	const displayName =
		thread.participants?.join(", ") || thread.sender || t("threadList.unknown");
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
							{formatWhen(thread.lastMessageAt, i18n.language)}
						</span>
					</div>
				</div>
				<div className="mt-1 flex items-center justify-between gap-2">
					<p className="min-w-0 flex-1 truncate text-sm">
						{thread.subject || t("threadList.noSubject")}
					</p>
					<SeenByAvatarGroup
						seenBy={thread.seenBy}
						showLabel
						className="shrink-0"
					/>
				</div>
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
				<p className="text-muted-foreground mt-1 truncate text-xs max-md:block md:h-0 md:origin-top md:scale-y-0 md:transform md:blur-xs md:transition-all md:duration-300 md:ease-in-out md:group-hover:h-4 md:group-hover:scale-y-100 md:group-hover:blur-none">
					{thread.preview || t("threadList.noPreview")}
				</p>
			</button>
		</li>
	);
}
