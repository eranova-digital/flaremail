import { useTranslation } from "react-i18next";

import {
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useLabels, usePatchThreadLabels } from "@/hooks/use-labels";
import { useThread } from "@/hooks/use-thread";
import { DEFAULT_LABEL_COLOR } from "@/lib/label-colors";

type ThreadLabelMenuItemsProps = {
	mailboxId: string;
	threadId: string;
};

/** Label checkboxes for embedding inside a thread actions dropdown. */
export function ThreadLabelMenuItems({
	mailboxId,
	threadId,
}: ThreadLabelMenuItemsProps) {
	const { t } = useTranslation("mail");
	const labelsQuery = useLabels(mailboxId);
	const threadQuery = useThread(mailboxId, threadId);
	const patchMutation = usePatchThreadLabels(mailboxId, threadId);

	const labels = labelsQuery.data ?? [];
	const threadLabelIds = new Set(threadQuery.data?.labelIds ?? []);

	const toggleLabel = (labelId: string, checked: boolean) => {
		const next = new Set(threadLabelIds);
		if (checked) {
			next.add(labelId);
		} else {
			next.delete(labelId);
		}
		patchMutation.mutate([...next]);
	};

	return (
		<>
			<DropdownMenuLabel>{t("labels.threadLabels")}</DropdownMenuLabel>
			{labelsQuery.isLoading ? (
				<p className="text-muted-foreground px-2 py-1.5 text-xs">{t("labels.loading")}</p>
			) : labels.length === 0 ? (
				<p className="text-muted-foreground px-2 py-1.5 text-xs">
					{t("labels.emptyPicker")}
				</p>
			) : (
				labels.map((label) => {
					if (!label.id) {
						return null;
					}
					const checked = threadLabelIds.has(label.id);
					return (
						<DropdownMenuCheckboxItem
							key={label.id}
							checked={checked}
							disabled={patchMutation.isPending}
							onCheckedChange={(value) => toggleLabel(label.id!, Boolean(value))}
							onSelect={(event) => event.preventDefault()}
						>
							<span className="flex min-w-0 items-center gap-2">
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{
										backgroundColor: label.color ?? DEFAULT_LABEL_COLOR,
									}}
								/>
								<span className="truncate">{label.name}</span>
							</span>
						</DropdownMenuCheckboxItem>
					);
				})
			)}
		</>
	);
}
