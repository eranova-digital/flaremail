import type { Editor } from "@tiptap/react";
import { FileStack, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
	TemplateHtmlPreview,
	useTemplateHtml,
} from "@/components/email-templates/TemplateHtmlPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useComposeTemplates } from "@/hooks/use-email-templates";
import { getErrorMessage } from "@/lib/api/errors";
import {
	fetchTemplateContent,
	type EmailTemplate,
} from "@/lib/email-templates/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type TemplateInsertControlProps = {
	editor: Editor;
	mailboxId: string;
	disabled?: boolean;
};

export function TemplateInsertControl({
	editor,
	mailboxId,
	disabled = false,
}: TemplateInsertControlProps) {
	const { t } = useTranslation("compose");
	const templatesQuery = useComposeTemplates(mailboxId);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [insertingId, setInsertingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [previewId, setPreviewId] = useState<string | null>(null);

	const templates = templatesQuery.data ?? [];
	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const match = (item: EmailTemplate) =>
			!needle || item.name.toLowerCase().includes(needle);

		return {
			global: templates.filter((item) => item.scope === "global" && match(item)),
			mailbox: templates.filter(
				(item) => item.scope === "mailbox" && match(item),
			),
		};
	}, [templates, query]);

	const previewTemplate = templates.find((item) => item.id === previewId) ?? null;
	const previewQuery = useTemplateHtml(
		queryKeys.templateContent(previewId ?? "", mailboxId),
		() => fetchTemplateContent(previewId!, mailboxId),
		open && Boolean(previewId),
	);

	if (templatesQuery.isLoading || templates.length === 0) {
		return null;
	}

	const insertTemplate = async (template: EmailTemplate) => {
		setError(null);
		setInsertingId(template.id);
		try {
			const html =
				previewId === template.id && previewQuery.data
					? previewQuery.data
					: await fetchTemplateContent(template.id, mailboxId);
			editor
				.chain()
				.focus()
				.insertComposeHtml(html, {
					locked: true,
					templateName: template.name,
				})
				.run();
			setOpen(false);
			setQuery("");
			setPreviewId(null);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setInsertingId(null);
		}
	};

	const hasResults =
		filtered.global.length > 0 || filtered.mailbox.length > 0;

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setQuery("");
					setError(null);
					setPreviewId(null);
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="size-8"
					disabled={disabled || insertingId !== null}
					aria-label={t("templates.insertAria")}
					tabIndex={-1}
				>
					<FileStack className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="flex w-[min(36rem,calc(100vw-2rem))] flex-col p-0 sm:flex-row"
				align="start"
			>
				<div className="flex w-full shrink-0 flex-col border-b sm:w-52 sm:border-r sm:border-b-0">
					<div className="relative border-b p-2">
						<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("templates.search")}
							className="h-8 pl-8 text-xs"
							autoFocus
						/>
					</div>
					<div className="max-h-40 overflow-y-auto p-1 sm:max-h-64">
						{!hasResults ? (
							<p className="text-muted-foreground px-2 py-3 text-center text-xs">
								{t("templates.noneFound")}
							</p>
						) : (
							<>
								{filtered.global.length > 0 ? (
									<TemplateGroup
										label={t("templates.global")}
										templates={filtered.global}
										insertingId={insertingId}
										previewId={previewId}
										onPreview={setPreviewId}
										onSelect={insertTemplate}
									/>
								) : null}
								{filtered.mailbox.length > 0 ? (
									<TemplateGroup
										label={t("templates.mailbox")}
										templates={filtered.mailbox}
										insertingId={insertingId}
										previewId={previewId}
										onPreview={setPreviewId}
										onSelect={insertTemplate}
									/>
								) : null}
							</>
						)}
					</div>
					{error ? (
						<p className="text-destructive border-t px-3 py-2 text-xs">{error}</p>
					) : null}
				</div>
				<div className="bg-muted/30 flex min-h-48 min-w-0 flex-1 flex-col sm:min-h-64">
					<div className="text-muted-foreground border-b px-3 py-1.5 text-xs font-medium">
						{previewTemplate ? previewTemplate.name : t("templates.preview")}
					</div>
					<div className="min-h-0 flex-1 overflow-hidden">
						<TemplateHtmlPreview
							html={previewQuery.data}
							isLoading={previewQuery.isFetching}
							error={
								previewQuery.isError
									? getErrorMessage(previewQuery.error)
									: null
							}
							emptyLabel={t("templates.hoverToPreview")}
							className="h-48 sm:h-64"
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function TemplateGroup({
	label,
	templates,
	insertingId,
	previewId,
	onPreview,
	onSelect,
}: {
	label: string;
	templates: EmailTemplate[];
	insertingId: string | null;
	previewId: string | null;
	onPreview: (id: string) => void;
	onSelect: (template: EmailTemplate) => void;
}) {
	return (
		<div className="py-1">
			<p className="text-muted-foreground px-2 py-1 text-xs font-medium">
				{label}
			</p>
			{templates.map((template) => (
				<button
					key={template.id}
					type="button"
					className={cn(
						"hover:bg-accent hover:text-accent-foreground flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm",
						previewId === template.id && "bg-accent text-accent-foreground",
						insertingId === template.id && "opacity-60",
					)}
					disabled={insertingId !== null}
					onMouseEnter={() => onPreview(template.id)}
					onFocus={() => onPreview(template.id)}
					onClick={() => void onSelect(template)}
				>
					{template.name}
				</button>
			))}
		</div>
	);
}
