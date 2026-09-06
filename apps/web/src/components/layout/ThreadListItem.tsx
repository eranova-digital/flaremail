import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Label, Thread } from "@/lib/api/client";
import { BimiAvatarGroup } from "@/components/BimiAvatarGroup";
import { SeenByAvatarGroup } from "@/components/SeenByAvatarGroup";
import { getInitialsFromLabel } from "@/components/ProfileAvatar";
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

function decodeHtmlEntities(value: string): string {
	if (!value.includes("&")) {
		return value;
	}
	const textarea = document.createElement("textarea");
	textarea.innerHTML = value;
	return textarea.value;
}

function isUrlLikeSnippet(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) {
		return false;
	}
	if (/^https?:\/\/\S+$/i.test(trimmed)) {
		return true;
	}
	const tokens = trimmed.split(/\s+/);
	const urlLength = tokens
		.filter((token) => /^https?:\/\/\S+$/i.test(token))
		.join("").length;
	return urlLength > 0 && urlLength / trimmed.length > 0.6;
}

function displaySnippet(preview: string | null | undefined): string | null {
	if (!preview?.trim()) {
		return null;
	}
	const decoded = decodeHtmlEntities(preview).replace(/\s+/g, " ").trim();
	if (!decoded || isUrlLikeSnippet(decoded)) {
		return null;
	}
	return decoded;
}

type ThreadListItemProps = {
	thread: Thread;
	selected: boolean;
	labels?: Label[];
	onSelect: () => void;
	bordered?: boolean;
};

export function ThreadListItem({
	thread,
	selected,
	labels = [],
	onSelect,
	bordered = true,
}: ThreadListItemProps) {
	const { t, i18n } = useTranslation("mail");
	const displayName =
		thread.participants?.join(", ") || thread.sender || t("threadList.unknown");
	const threadLabels = (thread.labelIds ?? [])
		.map((id) => labels.find((label) => label.id === id))
		.filter((label): label is Label => Boolean(label));
	const bimiDomains = thread.bimiDomains ?? [];
	const snippet = displaySnippet(thread.preview);

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"hover:bg-accent/60 group w-full cursor-pointer px-4 py-3 text-left transition-colors",
				bordered && "border-b",
				selected && "bg-primary/10",
				selected && thread.isRead && !thread.isStarred && "border-l-primary border-l-2",
				!thread.isRead && "border-l-primary border-l-3 font-semibold",
				thread.isStarred && "border-l-amber-500 border-l-3",
				thread.isStarred && thread.isRead && "border-l-amber-200 border-l-3",
			)}
		>
			<div className="flex items-start gap-2">
				<div className="flex h-8 w-10 shrink-0 items-center justify-center self-center">
					{bimiDomains.length > 0 ? (
						<BimiAvatarGroup domains={bimiDomains} size="sm" />
					) : (
						<span
							aria-hidden
							className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full text-[10px] font-medium"
						>
							{getInitialsFromLabel(displayName)}
						</span>
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline justify-between gap-2">
						<p className="text-muted-foreground min-w-0 truncate text-xs">
							{displayName}
						</p>
						<div className="flex shrink-0 items-center gap-1">
							{thread.isStarred ? (
								<Star className="size-3.5 fill-current text-amber-500" />
							) : null}
							<span className="text-muted-foreground text-xs whitespace-nowrap">
								{formatWhen(thread.lastMessageAt, i18n.language)}
							</span>
						</div>
					</div>
					<div className="mt-0.5 flex items-center justify-between gap-2">
						<p className="min-w-0 flex-1 truncate text-sm">
							{thread.subject || t("threadList.noSubject")}
							{snippet ? (
								<span className="text-muted-foreground font-normal">
									{" — "}
									{snippet}
								</span>
							) : null}
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
									className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
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
				</div>
			</div>
		</button>
	);
}
