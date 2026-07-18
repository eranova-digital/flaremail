import { describe, expect, it } from "vitest";

import { isStructuralHtml } from "@/lib/html";

describe("isStructuralHtml", () => {
	it("treats plain paragraphs as non-structural", () => {
		expect(isStructuralHtml("<p>Hello</p>")).toBe(false);
	});

	it("treats tables as structural", () => {
		expect(
			isStructuralHtml("<table><tr><td>Cell</td></tr></table>"),
		).toBe(true);
	});

	it("does not treat signature horizontal rules as structural", () => {
		expect(
			isStructuralHtml(
				'<p>Hello</p><div data-flaremail-signature="1"><hr><p>Pat</p></div>',
			),
		).toBe(false);
	});

	it("does not treat a body hr alone as structural", () => {
		expect(isStructuralHtml("<p>Hello</p><hr><p>Bye</p>")).toBe(false);
	});

	it("still treats body images as structural outside signatures", () => {
		expect(isStructuralHtml('<p>Hi</p><img src="cid:x" alt="">')).toBe(true);
	});

	it("ignores images that only appear inside a signature", () => {
		expect(
			isStructuralHtml(
				'<p>Hello</p><div data-flaremail-signature="1"><img src="cid:sig" alt=""></div>',
			),
		).toBe(false);
	});
});
