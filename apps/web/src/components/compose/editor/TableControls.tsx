import type { Editor } from "@tiptap/react";
import { Columns3, Rows3, TableProperties, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ToolbarButton } from "@/components/compose/editor/editor-controls";

type TableControlProps = {
	editor: Editor;
	disabled?: boolean;
	stickyTop?: number;
};

export function TableInsertButton({ editor, disabled = false }: TableControlProps) {
	const { t } = useTranslation("compose");
	const [open, setOpen] = useState(false);
	const [rows, setRows] = useState(3);
	const [cols, setCols] = useState(3);

	const insertTable = () => {
		editor
			.chain()
			.focus()
			.insertTable({
				rows: Math.max(1, rows),
				cols: Math.max(1, cols),
				withHeaderRow: true,
			})
			.run();
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="size-8"
					disabled={disabled}
					aria-label={t("table.insertAria")}
					tabIndex={-1}
				>
					<TableProperties className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-56 space-y-3 p-3" align="start">
				<p className="text-sm font-medium">{t("table.insert")}</p>
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<label className="text-muted-foreground text-xs" htmlFor="table-rows">
							{t("table.rows")}
						</label>
						<Input
							id="table-rows"
							type="number"
							min={1}
							max={20}
							value={rows}
							onChange={(event) =>
								setRows(Number.parseInt(event.target.value, 10) || 1)
							}
						/>
					</div>
					<div className="space-y-1">
						<label className="text-muted-foreground text-xs" htmlFor="table-cols">
							{t("table.columns")}
						</label>
						<Input
							id="table-cols"
							type="number"
							min={1}
							max={10}
							value={cols}
							onChange={(event) =>
								setCols(Number.parseInt(event.target.value, 10) || 1)
							}
						/>
					</div>
				</div>
				<Button type="button" className="w-full" onClick={insertTable}>
					{t("table.insertAction")}
				</Button>
			</PopoverContent>
		</Popover>
	);
}

export function TableEditBar({
	editor,
	disabled = false,
	stickyTop = 0,
}: TableControlProps) {
	const { t } = useTranslation("compose");

	return (
		<div
			className="border-border bg-muted/80 supports-backdrop-filter:bg-muted/60 sticky z-10 flex flex-wrap items-center gap-1 border-b px-2 py-1 backdrop-blur"
			style={{ top: stickyTop }}
		>
			<span className="text-muted-foreground mr-1 text-xs font-medium">
				{t("table.label")}
			</span>
			<ToolbarButton
				label={t("table.addRowAbove")}
				disabled={disabled}
				onClick={() => editor.chain().focus().addRowBefore().run()}
			>
				<Rows3 className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label={t("table.addRowBelow")}
				disabled={disabled}
				onClick={() => editor.chain().focus().addRowAfter().run()}
			>
				<Rows3 className="size-4 rotate-180" />
			</ToolbarButton>
			<ToolbarButton
				label={t("table.deleteRow")}
				disabled={disabled}
				onClick={() => editor.chain().focus().deleteRow().run()}
			>
				<Trash2 className="size-4" />
			</ToolbarButton>
			<div className="bg-border mx-1 h-6 w-px" />
			<ToolbarButton
				label={t("table.addColumnLeft")}
				disabled={disabled}
				onClick={() => editor.chain().focus().addColumnBefore().run()}
			>
				<Columns3 className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label={t("table.addColumnRight")}
				disabled={disabled}
				onClick={() => editor.chain().focus().addColumnAfter().run()}
			>
				<Columns3 className="size-4 rotate-180" />
			</ToolbarButton>
			<ToolbarButton
				label={t("table.deleteColumn")}
				disabled={disabled}
				onClick={() => editor.chain().focus().deleteColumn().run()}
			>
				<Trash2 className="size-4" />
			</ToolbarButton>
			<div className="bg-border mx-1 h-6 w-px" />
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="text-destructive h-8 px-2 text-xs"
				disabled={disabled}
				tabIndex={-1}
				onClick={() => editor.chain().focus().deleteTable().run()}
			>
				{t("table.deleteTable")}
			</Button>
		</div>
	);
}
