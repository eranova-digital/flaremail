import type { DOMOutputSpec } from "@tiptap/pm/model";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import {
	formatReplyQuotePlainText,
	parseReplyQuoteBlockquote,
	type ReplyQuoteContent,
} from "@/lib/build-reply-quote";

import { ReplyQuoteBlock } from "./ReplyQuoteBlock";

function isReplyQuoteBlockquote(element: HTMLElement): boolean {
	return (
		element.tagName === "BLOCKQUOTE" &&
		element.getAttribute("type") === "cite" &&
		element.classList.contains("quote")
	);
}

function paragraphToDom(text: string): DOMOutputSpec {
	const lines = text.split("\n");
	if (lines.length <= 1) {
		return ["p", {}, text];
	}

	const children: Array<string | DOMOutputSpec> = [];
	for (const [index, line] of lines.entries()) {
		if (index > 0) {
			children.push(["br"]);
		}
		children.push(line);
	}

	return ["p", {}, ...children];
}

function quoteParagraphsToDom({
	attribution,
	quotedText,
}: ReplyQuoteContent): DOMOutputSpec[] {
	const paragraphs: DOMOutputSpec[] = [paragraphToDom(attribution)];

	for (const block of quotedText.split(/\n\n+/)) {
		const trimmed = block.trim();
		if (trimmed) {
			paragraphs.push(paragraphToDom(trimmed));
		}
	}

	return paragraphs;
}

export const ComposeReplyQuote = Node.create({
	name: "replyQuote",

	group: "block",
	atom: true,
	selectable: true,
	draggable: false,

	addAttributes() {
		return {
			attribution: {
				default: "",
			},
			quotedText: {
				default: "",
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'blockquote[type="cite"]',
				priority: 100,
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) {
						return false;
					}

					if (!isReplyQuoteBlockquote(element)) {
						return false;
					}

					return parseReplyQuoteBlockquote(element);
				},
			},
		];
	},

	renderHTML({ node }) {
		return [
			"blockquote",
			mergeAttributes({ type: "cite", class: "quote" }),
			...quoteParagraphsToDom({
				attribution: node.attrs.attribution,
				quotedText: node.attrs.quotedText,
			}),
		];
	},

	renderText({ node }) {
		return formatReplyQuotePlainText({
			attribution: node.attrs.attribution,
			quotedText: node.attrs.quotedText,
		});
	},

	addNodeView() {
		return ReactNodeViewRenderer(ReplyQuoteBlock);
	},
});
