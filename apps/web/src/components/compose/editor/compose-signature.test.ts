import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { ComposeSignature } from "@/components/compose/editor/compose-signature";
import { SIGNATURE_ATTR } from "@/lib/identities/apply-signature";

describe("compose signature serialization", () => {
	it("includes signature content in getHTML", () => {
		const editor = new Editor({
			extensions: [StarterKit, ComposeSignature],
			content: "<p>Hi</p>",
		});

		expect(editor.commands.setComposeSignature("<p>Best,<br>Pat</p>")).toBe(
			true,
		);

		const html = editor.getHTML();
		expect(html).toContain(SIGNATURE_ATTR);
		expect(html).toContain("Best");
		expect(html).toContain("Pat");
		expect(html).toMatch(
			new RegExp(`<div[^>]*${SIGNATURE_ATTR}[^>]*>[\\s\\S]*Best`),
		);

		editor.destroy();
	});

	it("includes signature text in getText", () => {
		const editor = new Editor({
			extensions: [StarterKit, ComposeSignature],
			content: "<p>Hi</p>",
		});

		editor.commands.setComposeSignature("<p>Best regards</p>");
		expect(editor.getText({ blockSeparator: "\n\n" })).toContain("Best regards");

		editor.destroy();
	});

	it("does not insert a signature block for blank signature html", () => {
		const editor = new Editor({
			extensions: [StarterKit, ComposeSignature],
			content: "<p>Hi</p>",
		});

		expect(editor.commands.setComposeSignature("<p></p>")).toBe(true);
		expect(editor.getHTML()).not.toContain(SIGNATURE_ATTR);
		expect(editor.getHTML()).toContain("Hi");

		editor.commands.setComposeSignature("<p>Best</p>");
		expect(editor.getHTML()).toContain(SIGNATURE_ATTR);

		expect(editor.commands.setComposeSignature(null)).toBe(true);
		expect(editor.getHTML()).not.toContain(SIGNATURE_ATTR);

		editor.destroy();
	});
});
