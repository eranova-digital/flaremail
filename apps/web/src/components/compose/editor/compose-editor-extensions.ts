import Emoji from "@tiptap/extension-emoji";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";

import { ComposeImage } from "@/components/compose/editor/compose-image";

export function getComposeEditorExtensions(placeholder: string) {
	return [
		StarterKit.configure({
			heading: false,
			link: {
				autolink: true,
				linkOnPaste: true,
				openOnClick: false,
			},
		}),
		Highlight.configure({
			multicolor: true,
		}),
		Subscript,
		Superscript,
		TextStyleKit.configure({
			fontFamily: false,
			lineHeight: false,
		}),
		TextAlign.configure({
			types: ["paragraph"],
		}),
		ComposeImage.configure({
			inline: false,
			allowBase64: true,
		}),
		Table.configure({
			resizable: true,
		}),
		TableRow,
		TableHeader,
		TableCell,
		Emoji.configure({
			enableEmoticons: true,
		}),
		Placeholder.configure({
			placeholder,
			emptyEditorClass: "is-editor-empty",
		}),
	];
}
