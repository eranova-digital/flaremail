import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef, useState } from "react";

import { ComposeEditorToolbar } from "@/components/compose/editor/editor-controls";
import { ImageBubbleMenu } from "@/components/compose/editor/ImageBubbleMenu";
import { TableEditBar } from "@/components/compose/editor/TableControls";
import { getComposeEditorExtensions } from "@/components/compose/editor/compose-editor-extensions";
import { cn } from "@/lib/utils";

type ComposeEditorProps = {
	id?: string;
	initialHtml: string;
	/** Resolved signature HTML (tags already substituted). `null` clears; `undefined` leaves editor alone. */
	signatureHtml?: string | null;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	onChange: (value: { html: string; text: string }) => void;
};

export function ComposeEditor({
	id,
	initialHtml,
	signatureHtml,
	placeholder = "Write your message…",
	disabled = false,
	className,
	onChange,
}: ComposeEditorProps) {
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const [toolbarHeight, setToolbarHeight] = useState(0);

	const editor = useEditor({
		extensions: getComposeEditorExtensions(placeholder),
		content: initialHtml || "<p></p>",
		editable: !disabled,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				...(id ? { id } : {}),
				class:
					"compose-editor-content min-h-[inherit] px-3 py-2 text-sm outline-none",
			},
		},
		onUpdate: ({ editor: currentEditor }) => {
			onChangeRef.current({
				html: currentEditor.getHTML(),
				text: currentEditor.getText({ blockSeparator: "\n\n" }),
			});
		},
	});

	const isTableActive = useEditorState({
		editor,
		selector: ({ editor: currentEditor }) =>
			currentEditor?.isActive("table") ?? false,
	});

	useEffect(() => {
		if (!editor) {
			return;
		}

		editor.setEditable(!disabled);
	}, [disabled, editor]);

	useEffect(() => {
		if (!editor || signatureHtml === undefined) {
			return;
		}

		editor.commands.setComposeSignature(signatureHtml);
		onChangeRef.current({
			html: editor.getHTML(),
			text: editor.getText({ blockSeparator: "\n\n" }),
		});
	}, [editor, signatureHtml]);

	if (!editor) {
		return (
			<div
				className={cn(
					"border-input bg-background text-muted-foreground flex min-h-[160px] items-center justify-center rounded-md border text-sm shadow-sm",
					className,
				)}
			>
				Loading editor…
			</div>
		);
	}

	return (
		<div
			className={cn(
				"compose-editor border-input bg-background focus-within:ring-ring rounded-md border shadow-sm focus-within:ring-1",
				className,
			)}
		>
			<ComposeEditorToolbar
				editor={editor}
				disabled={disabled}
				onHeightChange={setToolbarHeight}
			/>
			{isTableActive ? (
				<TableEditBar
					editor={editor}
					disabled={disabled}
					stickyTop={toolbarHeight}
				/>
			) : null}
			<BubbleMenu
				editor={editor}
				pluginKey="imageBubbleMenu"
				shouldShow={({ editor: currentEditor }) =>
					currentEditor.isActive("image")
				}
			>
				<ImageBubbleMenu editor={editor} disabled={disabled} />
			</BubbleMenu>
			<EditorContent editor={editor} />
		</div>
	);
}
