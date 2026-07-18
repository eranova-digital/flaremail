import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import {
	COMPOSE_HTML_ATTR,
	ComposeHtml,
} from "@/components/compose/editor/compose-html";

describe("compose html block", () => {
	it("serializes raw html in getHTML", () => {
		const editor = new Editor({
			extensions: [StarterKit, ComposeHtml],
			content: "<p>Hi</p>",
		});

		expect(
			editor.commands.insertComposeHtml(
				'<table><tr><td style="color:red">Cell</td></tr></table>',
			),
		).toBe(true);

		const html = editor.getHTML();
		expect(html).toContain(COMPOSE_HTML_ATTR);
		expect(html).toContain("<table>");
		expect(html).toContain("Cell");
		expect(html).toContain('style="color:red"');

		editor.destroy();
	});

	it("includes plain text from html in getText", () => {
		const editor = new Editor({
			extensions: [StarterKit, ComposeHtml],
			content: "<p>Hi</p>",
		});

		editor.commands.insertComposeHtml("<p>Hello <strong>world</strong></p>");
		expect(editor.getText({ blockSeparator: "\n\n" })).toContain("Hello world");

		editor.destroy();
	});

	it("round-trips html through parseHTML", () => {
		const source = new Editor({
			extensions: [StarterKit, ComposeHtml],
			content: "<p>Hi</p>",
		});
		source.commands.insertComposeHtml("<div class='banner'>Promo</div>");
		const serialized = source.getHTML();
		source.destroy();

		const restored = new Editor({
			extensions: [StarterKit, ComposeHtml],
			content: serialized,
		});

		let foundHtml: string | null = null;
		restored.state.doc.descendants((node) => {
			if (node.type.name === "composeHtml") {
				foundHtml = node.attrs.html as string;
				return false;
			}
		});

		expect(foundHtml).toContain("Promo");
		expect(foundHtml).toContain("banner");
		restored.destroy();
	});

	it("keeps placeholder tags and stores values until resolved", () => {
		const editor = new Editor({
			extensions: [StarterKit, ComposeHtml],
			content: "<p></p>",
		});

		editor.commands.insertComposeHtml("<p>Hello {name}</p>");
		editor.commands.command(({ tr, state, dispatch }) => {
			let pos: number | null = null;
			state.doc.descendants((node, nodePos) => {
				if (node.type.name === "composeHtml") {
					pos = nodePos;
					return false;
				}
			});
			if (pos === null) {
				return false;
			}
			tr.setNodeMarkup(pos, undefined, {
				html: "<p>Hello {name}</p>",
				values: { name: "Pat" },
			});
			dispatch?.(tr);
			return true;
		});

		const html = editor.getHTML();
		expect(html).toContain("{name}");
		expect(html).toContain("Pat");

		editor.destroy();
	});
});
