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
export const COMPOSE_HTML_LOCKED_ATTR = "data-compose-html-locked";
export const COMPOSE_HTML_TEMPLATE_NAME_ATTR = "data-compose-html-template-name";

export type InsertComposeHtmlOptions = {
	locked?: boolean;
	templateName?: string | null;
};

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		composeHtml: {
			insertComposeHtml: (
				html?: string,
				options?: InsertComposeHtmlOptions,
			) => ReturnType;
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

function readLockedAttr(value: unknown): boolean {
	return value === true || value === "true" || value === "1";
}

function readTemplateNameAttr(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
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
			locked: {
				default: false,
				parseHTML: (element) =>
					element.hasAttribute(COMPOSE_HTML_LOCKED_ATTR),
				renderHTML: (attributes) =>
					readLockedAttr(attributes.locked)
						? { [COMPOSE_HTML_LOCKED_ATTR]: "1" }
						: {},
			},
			templateName: {
				default: null,
				parseHTML: (element) =>
					element.getAttribute(COMPOSE_HTML_TEMPLATE_NAME_ATTR),
				renderHTML: (attributes) => {
					const name = readTemplateNameAttr(attributes.templateName);
					return name
						? { [COMPOSE_HTML_TEMPLATE_NAME_ATTR]: name }
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
						locked: element.hasAttribute(COMPOSE_HTML_LOCKED_ATTR),
						templateName: element.getAttribute(
							COMPOSE_HTML_TEMPLATE_NAME_ATTR,
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

		if (readLockedAttr(node.attrs.locked)) {
			dom.setAttribute(COMPOSE_HTML_LOCKED_ATTR, "1");
		}

		const templateName = readTemplateNameAttr(node.attrs.templateName);
		if (templateName) {
			dom.setAttribute(COMPOSE_HTML_TEMPLATE_NAME_ATTR, templateName);
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
				(html = "", options = {}) =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: {
							html,
							values: {},
							locked: Boolean(options.locked),
							templateName: options.templateName ?? null,
						},
					}),
		};
	},
});
