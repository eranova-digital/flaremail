import { Check, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLabels, usePatchThreadLabels } from "@/hooks/use-labels";
import { useThread } from "@/hooks/use-thread";
import { DEFAULT_LABEL_COLOR } from "@/lib/label-colors";

type ThreadLabelPickerProps = {
	mailboxId: string;
	threadId: string;
};

export function ThreadLabelPicker({ mailboxId, threadId }: ThreadLabelPickerProps) {
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

	const labelsLabel = t("threadActions.labels");

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							disabled={patchMutation.isPending || labelsQuery.isLoading}
							aria-label={labelsLabel}
						>
							<Tag className="size-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{labelsLabel}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" className="w-52">
				<DropdownMenuLabel>{t("labels.threadLabels")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{labels.length === 0 ? (
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
								onCheckedChange={(value) => toggleLabel(label.id!, Boolean(value))}
								onSelect={(event) => event.preventDefault()}
							>
								<span className="flex items-center gap-2">
									<span
										className="size-2.5 shrink-0 rounded-full"
										style={{
											backgroundColor: label.color ?? DEFAULT_LABEL_COLOR,
										}}
									/>
									{label.name}
									{checked ? <Check className="ml-auto size-3.5 opacity-60" /> : null}
								</span>
							</DropdownMenuCheckboxItem>
						);
					})
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
