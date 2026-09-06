import { describe, expect, it } from "vitest";

import {
	parseSearchQuery,
	resolveSearchDateBound,
	SearchQueryError,
	splitSearchField,
	stripThreadOperators,
} from "@flaremail/mail-search-query";

function parseAst(query: string) {
	return parseSearchQuery(query).ast;
}

describe("parseSearchQuery", () => {
	it("parses juxtaposition as AND", () => {
		expect(parseAst("from:alice invoice")).toEqual({
			type: "and",
			left: { type: "op", name: "from", value: "alice" },
			right: { type: "text", value: "invoice" },
		});
	});

	it("parses explicit && and || with && tighter than ||", () => {
		expect(parseAst("from:alice || from:bob && invoice")).toEqual({
			type: "or",
			left: { type: "op", name: "from", value: "alice" },
			right: {
				type: "and",
				left: { type: "op", name: "from", value: "bob" },
				right: { type: "text", value: "invoice" },
			},
		});
	});

	it("parses parentheses to override precedence", () => {
		expect(parseAst("(from:alice || from:bob) && invoice")).toEqual({
			type: "and",
			left: {
				type: "or",
				left: { type: "op", name: "from", value: "alice" },
				right: { type: "op", name: "from", value: "bob" },
			},
			right: { type: "text", value: "invoice" },
		});
	});

	it("parses unary minus and quoted values", () => {
		expect(parseAst('-from:alice subject:"tax invoice"')).toEqual({
			type: "and",
			left: {
				type: "not",
				expr: { type: "op", name: "from", value: "alice" },
			},
			right: { type: "op", name: "subject", value: "tax invoice" },
		});
	});

	it("normalizes in/is/has values", () => {
		expect(parseAst("in:ANY is:UNREAD has:IMAGE")).toEqual({
			type: "and",
			left: {
				type: "and",
				left: { type: "op", name: "in", value: "any" },
				right: { type: "op", name: "is", value: "unread" },
			},
			right: { type: "op", name: "has", value: "image" },
		});
	});

	it("accepts has:.pdf", () => {
		expect(parseAst("has:.pdf")).toEqual({
			type: "op",
			name: "has",
			value: ".pdf",
		});
	});

	it("rejects unknown operators", () => {
		expect(() => parseSearchQuery("see:attached")).toThrow(SearchQueryError);
		expect(() => parseSearchQuery("see:attached")).toThrow("Unknown search operator");
	});

	it("rejects empty operator values and illegal closed-set values", () => {
		expect(() => parseSearchQuery("from:")).toThrow("Empty search operator value");
		expect(() => parseSearchQuery("in:other")).toThrow("Invalid search folder");
		expect(() => parseSearchQuery("is:foo")).toThrow("Invalid search is: value");
		expect(() => parseSearchQuery("has:video")).toThrow("Invalid search has: value");
		expect(() => parseSearchQuery("has:pdf")).toThrow("Invalid search has: value");
		expect(() => parseSearchQuery("since:not-a-date")).toThrow("Invalid search date");
	});

	it("rejects unclosed quotes and parens", () => {
		expect(() => parseSearchQuery('"hello')).toThrow("Unclosed quote in search query");
		expect(() => parseSearchQuery("(from:alice")).toThrow(
			"Unclosed parenthesis in search query",
		);
	});

	it("requires a non-empty query", () => {
		expect(() => parseSearchQuery("   ")).toThrow("Search query is required");
	});
});

describe("stripThreadOperators", () => {
	it("keeps same-message AND and drops thread operators", () => {
		const parsed = parseSearchQuery("from:alice && invoice && is:unread");
		expect(parsed.messageAst).toEqual({
			type: "and",
			left: { type: "op", name: "from", value: "alice" },
			right: { type: "text", value: "invoice" },
		});
	});

	it("keeps message side of OR with a thread operator", () => {
		const parsed = parseSearchQuery("from:alice || is:unread");
		expect(parsed.messageAst).toEqual({ type: "op", name: "from", value: "alice" });
		expect(parsed.hasInOperator).toBe(false);
	});

	it("returns null for thread-only queries", () => {
		expect(parseSearchQuery("is:unread").messageAst).toBeNull();
		expect(parseSearchQuery("in:trash").hasInOperator).toBe(true);
	});
});

describe("resolveSearchDateBound", () => {
	const now = new Date("2024-03-15T12:00:00.000Z");

	it("uses inclusive UTC day bounds for YYYY-MM-DD", () => {
		expect(resolveSearchDateBound("2024-01-31", now, "since").toISOString()).toBe(
			"2024-01-31T00:00:00.000Z",
		);
		expect(resolveSearchDateBound("2024-01-31", now, "until").toISOString()).toBe(
			"2024-01-31T23:59:59.999Z",
		);
	});

	it("resolves today and yesterday as UTC days", () => {
		expect(resolveSearchDateBound("today", now, "since").toISOString()).toBe(
			"2024-03-15T00:00:00.000Z",
		);
		expect(resolveSearchDateBound("yesterday", now, "until").toISOString()).toBe(
			"2024-03-14T23:59:59.999Z",
		);
	});

	it("resolves rolling durations from now", () => {
		expect(resolveSearchDateBound("7d", now, "since").toISOString()).toBe(
			"2024-03-08T12:00:00.000Z",
		);
		expect(resolveSearchDateBound("2w", now, "until").toISOString()).toBe(
			"2024-03-01T12:00:00.000Z",
		);
	});
});

describe("splitSearchField", () => {
	it("keeps the trailing operator token as draft", () => {
		expect(splitSearchField("from:ali")).toEqual({
			valid: true,
			tokens: [],
			draft: "from:ali",
		});
	});

	it("commits an operator after a trailing space", () => {
		expect(splitSearchField("from:alice ")).toEqual({
			valid: true,
			tokens: [{ type: "op", name: "from", value: "alice", negated: false }],
			draft: "",
		});
	});

	it("commits a negated operator as one pill", () => {
		expect(splitSearchField("-from:alice invoice")).toEqual({
			valid: true,
			tokens: [{ type: "op", name: "from", value: "alice", negated: true }],
			draft: "invoice",
		});
	});

	it("does not pillify an invalid query", () => {
		expect(splitSearchField("foo:bar")).toEqual({
			valid: false,
			draft: "foo:bar",
		});
	});
});
