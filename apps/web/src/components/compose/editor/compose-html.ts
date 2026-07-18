import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import {
	COMPOSE_HTML_VALUES_ATTR,
	applyHtmlPlaceholders,
	parseHtmlPlaceholderValues,
	serializeHtmlPlaceholderValues,
} from "@/components/compose/editor/html-placeholders";

import { HtmlBlock } from "./HtmlBlock";

export const COMPOSE_HTML_ATTR = "data-compose-html";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		composeHtml: {
			insertComposeHtml: (html?: string) => ReturnType;
		};
	}
}

function htmlToPlainText(html: string): string {
	if (!html.trim()) {
		return "";
	}

	const container = document.createElement("div");
	container.innerHTML = html;
	return (container.textContent ?? "").trim();
}

function readValuesAttr(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	const values: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === "string") {
			values[key] = entry;
		}
	}
	return values;
}

export const ComposeHtml = Node.create({
	name: "composeHtml",

	group: "block",
	atom: true,
	selectable: true,
	draggable: false,

	addAttributes() {
		return {
			html: {
				default: "",
			},
			values: {
				default: {},
				parseHTML: (element) =>
					parseHtmlPlaceholderValues(
						element.getAttribute(COMPOSE_HTML_VALUES_ATTR),
					),
				renderHTML: (attributes) => {
					const serialized = serializeHtmlPlaceholderValues(
						readValuesAttr(attributes.values),
					);
					return serialized
						? { [COMPOSE_HTML_VALUES_ATTR]: serialized }
						: {};
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: `div[${COMPOSE_HTML_ATTR}]`,
				priority: 100,
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) {
						return false;
					}

					return {
						html: element.innerHTML,
						values: parseHtmlPlaceholderValues(
							element.getAttribute(COMPOSE_HTML_VALUES_ATTR),
						),
					};
				},
			},
		];
	},

	renderHTML({ node }) {
		const dom = document.createElement("div");
		dom.setAttribute(COMPOSE_HTML_ATTR, "1");

		const serialized = serializeHtmlPlaceholderValues(
			readValuesAttr(node.attrs.values),
		);
		if (serialized) {
			dom.setAttribute(COMPOSE_HTML_VALUES_ATTR, serialized);
		}

		// Keep `{tags}` in stored HTML; values live in the data attr until send.
		dom.innerHTML = (node.attrs.html as string) || "";
		return dom;
	},

	renderText({ node }) {
		const filled = applyHtmlPlaceholders(
			(node.attrs.html as string) || "",
			readValuesAttr(node.attrs.values),
		);
		return htmlToPlainText(filled);
	},

	addNodeView() {
		return ReactNodeViewRenderer(HtmlBlock);
	},

	addCommands() {
		return {
			insertComposeHtml:
				(html = "") =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: { html, values: {} },
					}),
		};
	},
});
