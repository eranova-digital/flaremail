import type { Editor } from "@tiptap/core";
import { Node, mergeAttributes } from "@tiptap/core";
import {
	DOMParser as ProseMirrorDOMParser,
	DOMSerializer,
} from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { SIGNATURE_ATTR } from "@/lib/identities/apply-signature";

import { SignatureBlock } from "./SignatureBlock";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		composeSignature: {
			setComposeSignature: (html: string | null) => ReturnType;
		};
	}
}

function findSignatureRanges(
	doc: Editor["state"]["doc"],
	typeName: string,
): Array<{ from: number; to: number }> {
	const ranges: Array<{ from: number; to: number }> = [];
	doc.descendants((node, pos) => {
		if (node.type.name === typeName) {
			ranges.push({ from: pos, to: pos + node.nodeSize });
		}
	});
	return ranges;
}

function findSignatureInsertPos(doc: Editor["state"]["doc"]): number {
	let insertPos = doc.content.size;
	doc.descendants((node, pos) => {
		if (node.type.name === "replyQuote") {
			insertPos = pos;
			return false;
		}
	});
	return insertPos;
}

function normalizeSignatureHtml(html: string): string {
	return html.replace(/\s+/g, " ").trim();
}

function serializeSignatureInnerHtml(
	doc: Editor["state"]["doc"],
	schema: Editor["state"]["schema"],
	typeName: string,
): string | null {
	let inner: string | null = null;
	doc.descendants((node) => {
		if (node.type.name !== typeName) {
			return;
		}
		const serialized = DOMSerializer.fromSchema(schema).serializeNode(node);
		if (serialized instanceof HTMLElement) {
			inner = serialized.innerHTML;
		}
		return false;
	});
	return inner;
}

export const ComposeSignature = Node.create({
	name: "composeSignature",

	group: "block",
	content: "block+",
	/** Treat as a single non-editable unit while still serializing child HTML. */
	atom: true,
	defining: true,
	selectable: true,
	draggable: true,

	parseHTML() {
		return [
			{
				tag: `div[${SIGNATURE_ATTR}]`,
				priority: 100,
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(HTMLAttributes, { [SIGNATURE_ATTR]: "1" }),
			0,
		];
	},

	renderText({ node }) {
		const parts: string[] = [];
		node.descendants((child) => {
			if (child.isText && child.text) {
				parts.push(child.text);
			}
		});
		return parts.join("") || "";
	},

	addNodeView() {
		return ReactNodeViewRenderer(SignatureBlock);
	},

	addCommands() {
		return {
			setComposeSignature:
				(html: string | null) =>
				({ tr, state, dispatch }) => {
					const typeName = this.name;
					const trimmed = html?.trim() ? html.trim() : null;

					if (trimmed) {
						const existing = serializeSignatureInnerHtml(
							state.doc,
							state.schema,
							typeName,
						);
						if (
							existing !== null &&
							normalizeSignatureHtml(existing) ===
								normalizeSignatureHtml(trimmed)
						) {
							return true;
						}
					} else if (findSignatureRanges(state.doc, typeName).length === 0) {
						return true;
					}

					for (const range of findSignatureRanges(state.doc, typeName).reverse()) {
						tr.delete(range.from, range.to);
					}

					if (!trimmed) {
						dispatch?.(tr);
						return true;
					}

					const container = document.createElement("div");
					const wrapper = document.createElement("div");
					wrapper.setAttribute(SIGNATURE_ATTR, "1");
					wrapper.innerHTML = trimmed;
					container.appendChild(wrapper);

					const parsed = ProseMirrorDOMParser.fromSchema(state.schema).parse(
						container,
					);
					const signatureNode = parsed.firstChild;
					if (!signatureNode || signatureNode.type.name !== typeName) {
						dispatch?.(tr);
						return false;
					}

					const insertPos = findSignatureInsertPos(tr.doc);
					tr.insert(insertPos, signatureNode);
					dispatch?.(tr);
					return true;
				},
		};
	},
});
