import { describe, expect, it } from "vitest";

import { COMPOSE_HTML_ATTR } from "@/components/compose/editor/compose-html";
import {
	COMPOSE_HTML_VALUES_ATTR,
	applyHtmlPlaceholders,
	blankHtmlPlaceholders,
	findHtmlPlaceholders,
	resolveComposeHtmlDocument,
} from "@/components/compose/editor/html-placeholders";

describe("html placeholders", () => {
	it("finds unique placeholders in appearance order", () => {
		expect(
			findHtmlPlaceholders("Hi {name}, id={id}. Bye {name}!"),
		).toEqual(["name", "id"]);
	});

	it("finds placeholders that start with digits", () => {
		expect(findHtmlPlaceholders("{2nd_description} and {title}")).toEqual([
			"2nd_description",
			"title",
		]);
	});

	it("ignores css-like braces", () => {
		expect(findHtmlPlaceholders("<style>.x { color: red }</style>")).toEqual(
			[],
		);
	});

	it("applies filled values and leaves blanks", () => {
		expect(
			applyHtmlPlaceholders("<p>Hello {name}, ticket {id}</p>", {
				name: "Pat",
				id: "",
			}),
		).toBe("<p>Hello Pat, ticket {id}</p>");
	});

	it("reports blank placeholders", () => {
		expect(
			blankHtmlPlaceholders("<p>{name} {id}</p>", { name: "Pat", id: "  " }),
		).toEqual(["id"]);
	});

	it("replaces every occurrence of a filled tag", () => {
		expect(applyHtmlPlaceholders("{name} and {name}", { name: "Ada" })).toBe(
			"Ada and Ada",
		);
	});

	it("resolves compose html blocks for send", () => {
		const stored = `<div ${COMPOSE_HTML_ATTR}="1" ${COMPOSE_HTML_VALUES_ATTR}='{"name":"Pat"}'><p>Hi {name}</p></div>`;
		const resolved = resolveComposeHtmlDocument(stored, COMPOSE_HTML_ATTR);

		expect(resolved).toContain("Hi Pat");
		expect(resolved).not.toContain("{name}");
		expect(resolved).not.toContain(COMPOSE_HTML_VALUES_ATTR);
		expect(resolved).toContain(COMPOSE_HTML_ATTR);
	});
});
