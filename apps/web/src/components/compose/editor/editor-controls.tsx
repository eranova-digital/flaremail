import type { Editor } from "@tiptap/react";
import { emojis } from "@tiptap/extension-emoji";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	Code,
	Highlighter,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListOrdered,
	Minus,
	Palette,
	Quote,
	Redo,
	RemoveFormatting,
	Strikethrough,
	Subscript,
	Superscript,
	Smile,
	Underline,
	Undo,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { TableInsertButton } from "@/components/compose/editor/TableControls";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TEXT_COLORS = [
	"#000000",
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
] as const;

const BACKGROUND_COLORS = [
	"#fef08a",
	"#bbf7d0",
	"#bfdbfe",
	"#ddd6fe",
	"#fbcfe8",
	"#fed7aa",
	"#e5e7eb",
	"#ffffff",
] as const;

const HIGHLIGHT_COLORS = [
	"#fef08a",
	"#bbf7d0",
	"#bfdbfe",
	"#fbcfe8",
	"#fed7aa",
] as const;

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px"] as const;

const PICKER_EMOJIS = emojis
	.filter((item) => item.emoji)
	.slice(0, 64);

type ControlProps = {
	editor: Editor;
	disabled?: boolean;
	compact?: boolean;
};

type ToolbarButtonProps = {
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
	label: string;
	children: ReactNode;
};

export function ToolbarButton({
	onClick,
	isActive = false,
	disabled = false,
	label,
	children,
}: ToolbarButtonProps) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-xs"
			className={cn("size-8", isActive && "bg-accent text-accent-foreground")}
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			aria-pressed={isActive}
			tabIndex={-1}
		>
			{children}
		</Button>
	);
}

function ToolbarDivider() {
	return <div className="bg-border mx-0.5 h-6 w-px" />;
}

function setLink(editor: Editor) {
	const previousUrl = editor.getAttributes("link").href as string | undefined;
	const url = window.prompt("URL", previousUrl ?? "https://");

	if (url === null) {
		return;
	}

	if (url === "") {
		editor.chain().focus().extendMarkRange("link").unsetLink().run();
		return;
	}

	editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

function uploadImage(editor: Editor, file: File) {
	const reader = new FileReader();
	reader.onload = () => {
		const src = reader.result;
		if (typeof src !== "string") {
			return;
		}

		editor
			.chain()
			.focus()
			.insertContent({
				type: "image",
				attrs: { src, width: "100%", align: "left" },
			})
			.run();
	};
	reader.readAsDataURL(file);
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHexColor(color: string | undefined): string | null {
	if (!color) {
		return null;
	}

	const trimmed = color.trim();
	if (!HEX_COLOR_RE.test(trimmed)) {
		return null;
	}

	if (trimmed.length === 4) {
		const [, r, g, b] = trimmed;
		return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
	}

	return trimmed.toLowerCase();
}

function ColorSwatches({
	colors,
	value,
	onPick,
	onClear,
	clearLabel,
}: {
	colors: readonly string[];
	value?: string;
	onPick: (color: string) => void;
	onClear?: () => void;
	clearLabel?: string;
}) {
	const activeHex = normalizeHexColor(value);
	const [hexDraft, setHexDraft] = useState(activeHex ?? "");

	useEffect(() => {
		setHexDraft(activeHex ?? "");
	}, [activeHex]);

	const applyHexDraft = () => {
		const normalized = normalizeHexColor(hexDraft);
		if (normalized) {
			onPick(normalized);
			setHexDraft(normalized);
			return;
		}

		setHexDraft(activeHex ?? "");
	};

	return (
		<div className="grid grid-cols-4 gap-2">
			{colors.map((color) => (
				<button
					key={color}
					type="button"
					className={cn(
						"size-7 rounded-md border shadow-sm",
						activeHex === color.toLowerCase() && "ring-ring ring-2 ring-offset-1",
					)}
					style={{ backgroundColor: color }}
					aria-label={`Color ${color}`}
					aria-pressed={activeHex === color.toLowerCase()}
					tabIndex={-1}
					onClick={() => onPick(color)}
				/>
			))}
			<div className="col-span-4 flex items-center gap-2 border-t pt-2">
				<input
					type="color"
					className="border-input size-8 cursor-pointer rounded-md border bg-transparent p-0.5"
					value={activeHex ?? "#000000"}
					aria-label="Custom color"
					tabIndex={-1}
					onChange={(event) => onPick(event.target.value)}
				/>
				<Input
					value={hexDraft}
					placeholder="#000000"
					aria-label="Custom color hex"
					className="h-8 font-mono text-xs"
					tabIndex={-1}
					onChange={(event) => setHexDraft(event.target.value)}
					onBlur={applyHexDraft}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							applyHexDraft();
						}
					}}
				/>
			</div>
			{onClear ? (
				<button
					type="button"
					className="text-muted-foreground col-span-4 rounded-md border px-2 py-1 text-xs"
					tabIndex={-1}
					onClick={onClear}
				>
					{clearLabel ?? "Clear"}
				</button>
			) : null}
		</div>
	);
}

export function MarkControls({ editor, disabled = false }: ControlProps) {
	const currentHighlight =
		(editor.getAttributes("highlight").color as string | undefined) ?? "";

	return (
		<>
			<ToolbarButton
				label="Bold"
				isActive={editor.isActive("bold")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleBold().run()}
			>
				<Bold className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Italic"
				isActive={editor.isActive("italic")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleItalic().run()}
			>
				<Italic className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Underline"
				isActive={editor.isActive("underline")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleUnderline().run()}
			>
				<Underline className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Strikethrough"
				isActive={editor.isActive("strike")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleStrike().run()}
			>
				<Strikethrough className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Code"
				isActive={editor.isActive("code")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleCode().run()}
			>
				<Code className="size-4" />
			</ToolbarButton>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className={cn(
							"size-8",
							editor.isActive("highlight") &&
								"bg-accent text-accent-foreground",
						)}
						disabled={disabled}
						aria-label="Highlight"
						tabIndex={-1}
					>
						<Highlighter className="size-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-3" align="start">
					<ColorSwatches
						colors={HIGHLIGHT_COLORS}
						value={currentHighlight}
						onPick={(color) =>
							editor.chain().focus().toggleHighlight({ color }).run()
						}
						onClear={() => editor.chain().focus().unsetHighlight().run()}
						clearLabel="Remove highlight"
					/>
				</PopoverContent>
			</Popover>
			<ToolbarButton
				label="Subscript"
				isActive={editor.isActive("subscript")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleSubscript().run()}
			>
				<Subscript className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Superscript"
				isActive={editor.isActive("superscript")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleSuperscript().run()}
			>
				<Superscript className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Link"
				isActive={editor.isActive("link")}
				disabled={disabled}
				onClick={() => setLink(editor)}
			>
				<Link2 className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Clear formatting"
				disabled={disabled}
				onClick={() =>
					editor.chain().focus().unsetAllMarks().clearNodes().run()
				}
			>
				<RemoveFormatting className="size-4" />
			</ToolbarButton>
		</>
	);
}

export function StyleControls({ editor, disabled = false }: ControlProps) {
	const currentColor =
		(editor.getAttributes("textStyle").color as string | undefined) ?? "";
	const currentBackground =
		(editor.getAttributes("textStyle").backgroundColor as string | undefined) ??
		"";
	const currentFontSize =
		(editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";

	return (
		<>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="size-8"
						disabled={disabled}
						aria-label="Text color"
						tabIndex={-1}
					>
						<Palette className="size-4" style={{ color: currentColor || undefined }} />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-3" align="start">
					<p className="text-muted-foreground mb-2 text-xs font-medium">
						Text color
					</p>
					<ColorSwatches
						colors={TEXT_COLORS}
						value={currentColor}
						onPick={(color) => editor.chain().focus().setColor(color).run()}
						onClear={() => editor.chain().focus().unsetColor().run()}
						clearLabel="Default color"
					/>
				</PopoverContent>
			</Popover>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 px-2"
						disabled={disabled}
						aria-label="Background color"
						tabIndex={-1}
					>
						<span
							className="size-4 rounded-sm border"
							style={{ backgroundColor: currentBackground || "#ffffff" }}
						/>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-3" align="start">
					<p className="text-muted-foreground mb-2 text-xs font-medium">
						Background color
					</p>
					<ColorSwatches
						colors={BACKGROUND_COLORS}
						value={currentBackground}
						onPick={(color) =>
							editor.chain().focus().setBackgroundColor(color).run()
						}
						onClear={() => editor.chain().focus().unsetBackgroundColor().run()}
						clearLabel="No background"
					/>
				</PopoverContent>
			</Popover>
			<Select
				value={currentFontSize || "default"}
				onValueChange={(value) => {
					if (value === "default") {
						editor.chain().focus().unsetFontSize().run();
						return;
					}

					editor.chain().focus().setFontSize(value).run();
				}}
				disabled={disabled}
			>
				<SelectTrigger className="h-8 w-[5.5rem] px-2 text-xs" tabIndex={-1}>
					<SelectValue placeholder="Size" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="default">Default</SelectItem>
					{FONT_SIZES.map((size) => (
						<SelectItem key={size} value={size}>
							{size}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</>
	);
}

export function AlignControls({ editor, disabled = false }: ControlProps) {
	return (
		<>
			<ToolbarButton
				label="Align left"
				isActive={editor.isActive({ textAlign: "left" })}
				disabled={disabled}
				onClick={() => editor.chain().focus().setTextAlign("left").run()}
			>
				<AlignLeft className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Align center"
				isActive={editor.isActive({ textAlign: "center" })}
				disabled={disabled}
				onClick={() => editor.chain().focus().setTextAlign("center").run()}
			>
				<AlignCenter className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Align right"
				isActive={editor.isActive({ textAlign: "right" })}
				disabled={disabled}
				onClick={() => editor.chain().focus().setTextAlign("right").run()}
			>
				<AlignRight className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Justify"
				isActive={editor.isActive({ textAlign: "justify" })}
				disabled={disabled}
				onClick={() => editor.chain().focus().setTextAlign("justify").run()}
			>
				<AlignJustify className="size-4" />
			</ToolbarButton>
		</>
	);
}

export function BlockControls({ editor, disabled = false }: ControlProps) {
	const [emojiOpen, setEmojiOpen] = useState(false);
	const imageInputRef = useRef<HTMLInputElement>(null);

	return (
		<>
			<ToolbarButton
				label="Bullet list"
				isActive={editor.isActive("bulletList")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleBulletList().run()}
			>
				<List className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Numbered list"
				isActive={editor.isActive("orderedList")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
			>
				<ListOrdered className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Blockquote"
				isActive={editor.isActive("blockquote")}
				disabled={disabled}
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
			>
				<Quote className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Horizontal rule"
				disabled={disabled}
				onClick={() => editor.chain().focus().setHorizontalRule().run()}
			>
				<Minus className="size-4" />
			</ToolbarButton>
			<input
				ref={imageInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) {
						uploadImage(editor, file);
					}
					event.target.value = "";
				}}
			/>
			<ToolbarButton
				label="Upload image"
				disabled={disabled}
				onClick={() => imageInputRef.current?.click()}
			>
				<ImageIcon className="size-4" />
			</ToolbarButton>
			<TableInsertButton editor={editor} disabled={disabled} />
			<Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="size-8"
						disabled={disabled}
						aria-label="Insert emoji"
						tabIndex={-1}
					>
						<Smile className="size-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-72 p-2" align="start">
					<div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
						{PICKER_EMOJIS.map((item) => (
							<button
								key={item.name}
								type="button"
								className="hover:bg-accent rounded-md p-1 text-lg leading-none"
								aria-label={item.name}
								tabIndex={-1}
								onClick={() => {
									editor.chain().focus().setEmoji(item.name).run();
									setEmojiOpen(false);
								}}
							>
								{item.emoji}
							</button>
						))}
					</div>
				</PopoverContent>
			</Popover>
		</>
	);
}

export function HistoryControls({ editor, disabled = false }: ControlProps) {
	return (
		<>
			<ToolbarButton
				label="Undo"
				disabled={disabled || !editor.can().chain().focus().undo().run()}
				onClick={() => editor.chain().focus().undo().run()}
			>
				<Undo className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Redo"
				disabled={disabled || !editor.can().chain().focus().redo().run()}
				onClick={() => editor.chain().focus().redo().run()}
			>
				<Redo className="size-4" />
			</ToolbarButton>
		</>
	);
}

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
	let current = node?.parentElement ?? null;
	while (current) {
		const { overflowY } = getComputedStyle(current);
		if (
			overflowY === "auto" ||
			overflowY === "scroll" ||
			overflowY === "overlay"
		) {
			return current;
		}
		current = current.parentElement;
	}
	return null;
}

function useStuckToTop() {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [stuck, setStuck] = useState(false);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) {
			return;
		}

		const scrollRoot = getScrollParent(sentinel);
		const paddingTop = scrollRoot
			? Number.parseFloat(getComputedStyle(scrollRoot).paddingTop) || 0
			: 0;

		const observer = new IntersectionObserver(
			([entry]) => setStuck(!entry.isIntersecting),
			{
				root: scrollRoot,
				rootMargin: `-${paddingTop}px 0px 0px 0px`,
				threshold: 0,
			},
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, []);

	return { sentinelRef, stuck };
}

type ToolbarProps = ControlProps & {
	onHeightChange?: (height: number) => void;
};

export function ComposeEditorToolbar({
	editor,
	disabled = false,
	onHeightChange,
}: ToolbarProps) {
	const { sentinelRef, stuck } = useStuckToTop();
	const toolbarRef = useRef<HTMLDivElement>(null);
	const onHeightChangeRef = useRef(onHeightChange);
	onHeightChangeRef.current = onHeightChange;

	useEffect(() => {
		const node = toolbarRef.current;
		if (!node) {
			return;
		}

		const report = () => onHeightChangeRef.current?.(node.offsetHeight);
		report();

		const observer = new ResizeObserver(report);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return (
		<>
			<div ref={sentinelRef} aria-hidden className="h-0" />
			<div
				ref={toolbarRef}
				className={cn(
					"border-border bg-muted/80 supports-backdrop-filter:bg-muted/60 sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b px-1 py-1 backdrop-blur",
					!stuck && "rounded-t-md",
				)}
			>
				<MarkControls editor={editor} disabled={disabled} />
				<ToolbarDivider />
				<StyleControls editor={editor} disabled={disabled} />
				<ToolbarDivider />
				<AlignControls editor={editor} disabled={disabled} />
				<ToolbarDivider />
				<BlockControls editor={editor} disabled={disabled} />
				<ToolbarDivider />
				<HistoryControls editor={editor} disabled={disabled} />
			</div>
		</>
	);
}
