import { describe, expect, it, vi } from "vitest";

import {
	findEmailLinkFromEvent,
	isNavigableEmailLink,
	openEmailLinkInNewTab,
} from "@/lib/email-links";

describe("isNavigableEmailLink", () => {
	it("allows common safe hrefs", () => {
		expect(isNavigableEmailLink("https://example.com")).toBe(true);
		expect(isNavigableEmailLink("http://example.com")).toBe(true);
		expect(isNavigableEmailLink("mailto:test@example.com")).toBe(true);
		expect(isNavigableEmailLink("/relative/path")).toBe(true);
	});

	it("blocks empty, fragment-only, and dangerous hrefs", () => {
		expect(isNavigableEmailLink(null)).toBe(false);
		expect(isNavigableEmailLink("")).toBe(false);
		expect(isNavigableEmailLink("#")).toBe(false);
		expect(isNavigableEmailLink("javascript:alert(1)")).toBe(false);
		expect(isNavigableEmailLink("data:text/html,<script>alert(1)</script>")).toBe(
			false,
		);
		expect(isNavigableEmailLink("vbscript:msgbox(1)")).toBe(false);
	});
});

describe("findEmailLinkFromEvent", () => {
	it("returns the closest anchor element", () => {
		const anchor = document.createElement("a");
		anchor.href = "https://example.com";
		const span = document.createElement("span");
		span.textContent = "Link";
		anchor.append(span);
		document.body.append(anchor);

		expect(findEmailLinkFromEvent(span)).toBe(anchor);
		expect(findEmailLinkFromEvent(anchor)).toBe(anchor);
		expect(findEmailLinkFromEvent(document.body)).toBeNull();

		anchor.remove();
	});
});

describe("openEmailLinkInNewTab", () => {
	it("opens links in a new tab with noopener", () => {
		const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

		openEmailLinkInNewTab("https://example.com");

		expect(openSpy).toHaveBeenCalledWith(
			"https://example.com",
			"_blank",
			"noopener,noreferrer",
		);

		openSpy.mockRestore();
	});
});
