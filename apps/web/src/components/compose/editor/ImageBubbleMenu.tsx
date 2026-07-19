import type { Editor } from "@tiptap/react";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const IMAGE_WIDTHS = ["25%", "50%", "75%", "100%"] as const;

type ImageBubbleMenuProps = {
	editor: Editor;
	disabled?: boolean;
};

export function ImageBubbleMenu({ editor, disabled = false }: ImageBubbleMenuProps) {
	const { t } = useTranslation("compose");
	const currentWidth =
		(editor.getAttributes("image").width as string | undefined) ?? "100%";
	const currentAlign =
		(editor.getAttributes("image").align as string | undefined) ?? "left";

	return (
		<div className="bg-popover text-popover-foreground flex flex-wrap items-center gap-1 rounded-md border p-1 shadow-md">
			<Select
				value={currentWidth}
				onValueChange={(value) => {
					editor
						.chain()
						.focus()
						.updateAttributes("image", { width: value })
						.run();
				}}
				disabled={disabled}
			>
				<SelectTrigger className="h-8 w-24 px-2 text-xs">
					<SelectValue placeholder={t("image.width")} />
				</SelectTrigger>
				<SelectContent>
					{IMAGE_WIDTHS.map((width) => (
						<SelectItem key={width} value={width}>
							{width}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className={cn(
					"size-8",
					currentAlign === "left" && "bg-accent text-accent-foreground",
				)}
				disabled={disabled}
				aria-label={t("image.alignLeft")}
				onClick={() =>
					editor.chain().focus().updateAttributes("image", { align: "left" }).run()
				}
			>
				<AlignLeft className="size-4" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className={cn(
					"size-8",
					currentAlign === "center" && "bg-accent text-accent-foreground",
				)}
				disabled={disabled}
				aria-label={t("image.alignCenter")}
				onClick={() =>
					editor
						.chain()
						.focus()
						.updateAttributes("image", { align: "center" })
						.run()
				}
			>
				<AlignCenter className="size-4" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className={cn(
					"size-8",
					currentAlign === "right" && "bg-accent text-accent-foreground",
				)}
				disabled={disabled}
				aria-label={t("image.alignRight")}
				onClick={() =>
					editor
						.chain()
						.focus()
						.updateAttributes("image", { align: "right" })
						.run()
				}
			>
				<AlignRight className="size-4" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="text-destructive size-8"
				disabled={disabled}
				aria-label={t("image.remove")}
				onClick={() => editor.chain().focus().deleteSelection().run()}
			>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}
