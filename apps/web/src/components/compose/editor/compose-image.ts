import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";

export const ComposeImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			width: {
				default: null,
				parseHTML: (element) =>
					element.getAttribute("width") ??
					element.style.width?.replace(/px$/, "") ??
					null,
				renderHTML: (attributes) => {
					if (!attributes.width) {
						return {};
					}

					return {
						width: attributes.width,
					};
				},
			},
			align: {
				default: "left",
				parseHTML: (element) => element.getAttribute("data-align") ?? "left",
				renderHTML: (attributes) => ({
					"data-align": attributes.align,
				}),
			},
		};
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"img",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
		];
	},
});
