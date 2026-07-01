import { describe, expect, it } from "vitest";

import {
	parseReplyBody,
	replySubject,
} from "../src/lib/messages/outbound-payload";

describe("replySubject", () => {
	it("prepends Re: to a plain subject", () => {
		expect(replySubject("Hello")).toBe("Re: Hello");
	});

	it("does not prepend Re: when already present", () => {
		expect(replySubject("Re: Hello")).toBe("Re: Hello");
		expect(replySubject("RE: Hello")).toBe("RE: Hello");
	});

	it("returns Re: for an empty parent subject", () => {
		expect(replySubject(null)).toBe("Re:");
		expect(replySubject("")).toBe("Re:");
		expect(replySubject("   ")).toBe("Re:");
	});
});

describe("parseReplyBody", () => {
	it("treats blank subject as omitted", () => {
		expect(
			parseReplyBody({
				mailboxId: "00000000-0000-0000-0000-000000000001",
				text: "Thanks",
				subject: "   ",
			}),
		).toMatchObject({
			subject: undefined,
		});
	});
});
