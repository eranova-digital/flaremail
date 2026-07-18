import { Eye } from "lucide-react";
import { useState } from "react";

import {
	TemplateHtmlPreview,
	useTemplateHtml,
} from "@/components/email-templates/TemplateHtmlPreview";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getErrorMessage } from "@/lib/api/errors";
import {
	fetchSystemTemplateContent,
	fetchTemplateContent,
	type SystemEmailTemplateKey,
} from "@/lib/email-templates/api";
import { queryKeys } from "@/lib/query-keys";

type ComposeTemplatePreviewButtonProps = {
	templateId: string;
	/** Compose mailbox context; omit for management (global / managed mailbox). */
	mailboxId?: string | null;
	label?: string;
};

export function ComposeTemplatePreviewButton({
	templateId,
	mailboxId,
	label = "Preview",
}: ComposeTemplatePreviewButtonProps) {
	const [open, setOpen] = useState(false);
	const previewQuery = useTemplateHtml(
		queryKeys.templateContent(templateId, mailboxId),
		() => fetchTemplateContent(templateId, mailboxId ?? undefined),
		open,
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button type="button" variant="ghost" size="sm" className="gap-1.5">
					<Eye className="size-3.5" aria-hidden />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="end">
				<div className="text-muted-foreground border-b px-3 py-1.5 text-xs font-medium">
					Preview
				</div>
				<div className="h-72 overflow-hidden">
					<TemplateHtmlPreview
						html={previewQuery.data}
						isLoading={previewQuery.isFetching}
						error={
							previewQuery.isError ? getErrorMessage(previewQuery.error) : null
						}
						className="h-72"
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}

type SystemTemplatePreviewButtonProps = {
	templateKey: SystemEmailTemplateKey;
	disabled?: boolean;
	label?: string;
};

export function SystemTemplatePreviewButton({
	templateKey,
	disabled = false,
	label = "Preview",
}: SystemTemplatePreviewButtonProps) {
	const [open, setOpen] = useState(false);
	const previewQuery = useTemplateHtml(
		queryKeys.systemTemplateContent(templateKey),
		() => fetchSystemTemplateContent(templateKey),
		open && !disabled,
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="gap-1.5"
					disabled={disabled}
				>
					<Eye className="size-3.5" aria-hidden />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="end">
				<div className="text-muted-foreground border-b px-3 py-1.5 text-xs font-medium">
					Preview
				</div>
				<div className="h-72 overflow-hidden">
					<TemplateHtmlPreview
						html={previewQuery.data}
						isLoading={previewQuery.isFetching}
						error={
							previewQuery.isError ? getErrorMessage(previewQuery.error) : null
						}
						className="h-72"
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
