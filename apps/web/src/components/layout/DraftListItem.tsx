import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DraftPage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type DraftListItemData = DraftPage["items"][number];

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

type DraftListItemProps = {
	draft: DraftListItemData;
	selected: boolean;
	onSelect: () => void;
};

export function DraftListItem({ draft, selected, onSelect }: DraftListItemProps) {
	const { t, i18n } = useTranslation("mail");
	const recipients =
		[draft.to, draft.cc].filter(Boolean).join(", ") || t("threadList.unknown");

	return (
		<li>
			<button
				type="button"
				onClick={onSelect}
				className={cn(
					"hover:bg-accent/60 group w-full cursor-pointer border-b px-4 py-3 text-left transition-colors",
					selected && "bg-accent",
				)}
			>
				<div className="flex items-start justify-between gap-2">
					<p className="text-muted-foreground truncate text-xs">{recipients}</p>
					<span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
						{formatWhen(draft.receivedAt, i18n.language)}
					</span>
				</div>
				<div className="mt-1 flex items-center gap-2">
					<p className="min-w-0 flex-1 truncate text-sm">
						{draft.subject || t("threadList.noSubject")}
					</p>
					{draft.hasAttachments ? (
						<Paperclip className="text-muted-foreground size-3.5 shrink-0" />
					) : null}
				</div>
				{draft.preview ? (
					<p className="text-muted-foreground mt-1 truncate text-xs">{draft.preview}</p>
				) : null}
			</button>
		</li>
	);
}
