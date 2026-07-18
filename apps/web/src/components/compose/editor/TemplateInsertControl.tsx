import type { Editor } from "@tiptap/react";
import { FileStack, Search } from "lucide-react";
import { useMemo, useState } from "react";

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
	const templatesQuery = useComposeTemplates(mailboxId);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [insertingId, setInsertingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

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

	if (templatesQuery.isLoading || templates.length === 0) {
		return null;
	}

	const insertTemplate = async (template: EmailTemplate) => {
		setError(null);
		setInsertingId(template.id);
		try {
			const html = await fetchTemplateContent(template.id, mailboxId);
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
					aria-label="Insert email template"
					tabIndex={-1}
				>
					<FileStack className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="start">
				<div className="relative border-b p-2">
					<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search templates…"
						className="h-8 pl-8 text-xs"
						autoFocus
					/>
				</div>
				<div className="max-h-56 overflow-y-auto p-1">
					{!hasResults ? (
						<p className="text-muted-foreground px-2 py-3 text-center text-xs">
							No templates found
						</p>
					) : (
						<>
							{filtered.global.length > 0 ? (
								<TemplateGroup
									label="Global"
									templates={filtered.global}
									insertingId={insertingId}
									onSelect={insertTemplate}
								/>
							) : null}
							{filtered.mailbox.length > 0 ? (
								<TemplateGroup
									label="Mailbox"
									templates={filtered.mailbox}
									insertingId={insertingId}
									onSelect={insertTemplate}
								/>
							) : null}
						</>
					)}
				</div>
				{error ? (
					<p className="text-destructive border-t px-3 py-2 text-xs">{error}</p>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

function TemplateGroup({
	label,
	templates,
	insertingId,
	onSelect,
}: {
	label: string;
	templates: EmailTemplate[];
	insertingId: string | null;
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
						insertingId === template.id && "opacity-60",
					)}
					disabled={insertingId !== null}
					onClick={() => void onSelect(template)}
				>
					{template.name}
				</button>
			))}
		</div>
	);
}
