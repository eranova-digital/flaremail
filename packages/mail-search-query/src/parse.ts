import {
	containsOperator,
	stripThreadOperators,
	type ParsedSearchQuery,
	type SearchExpr,
} from "./ast";
import { isValidSearchDateValue } from "./dates";
import { SearchQueryError } from "./error";
import { lexSearchQuery, type LexToken } from "./lex";
import {
	isHasValue,
	isInValue,
	isIsValue,
} from "./operators";

export function parseSearchQuery(input: string): ParsedSearchQuery {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new SearchQueryError("Search query is required", "search-query-required");
	}
	const ast = parseTokens(lexSearchQuery(trimmed));
	return {
		ast,
		messageAst: stripThreadOperators(ast),
		hasInOperator: containsOperator(ast, "in"),
	};
}

export function parseTokens(tokens: LexToken[]): SearchExpr {
	let pos = 0;

	const peek = (): LexToken | undefined => tokens[pos];
	const consume = (): LexToken => {
		const token = tokens[pos];
		if (!token) {
			throw new SearchQueryError("Invalid search query", "invalid-search-query");
		}
		pos += 1;
		return token;
	};

	const parseOr = (): SearchExpr => {
		let left = parseAnd();
		while (peek()?.type === "or") {
			consume();
			left = { type: "or", left, right: parseAnd() };
		}
		return left;
	};

	const parseAnd = (): SearchExpr => {
		let left = parseNot();
		for (;;) {
			const next = peek();
			if (!next || next.type === "or" || next.type === "rparen") {
				break;
			}
			if (next.type === "and") {
				consume();
				left = { type: "and", left, right: parseNot() };
				continue;
			}
			if (
				next.type === "not" ||
				next.type === "lparen" ||
				next.type === "text" ||
				next.type === "op"
			) {
				left = { type: "and", left, right: parseNot() };
				continue;
			}
			throw new SearchQueryError("Invalid search query", "invalid-search-query");
		}
		return left;
	};

	const parseNot = (): SearchExpr => {
		if (peek()?.type === "not") {
			consume();
			return { type: "not", expr: parseNot() };
		}
		return parsePrimary();
	};

	const parsePrimary = (): SearchExpr => {
		const token = peek();
		if (!token) {
			throw new SearchQueryError("Invalid search query", "invalid-search-query");
		}
		if (token.type === "lparen") {
			consume();
			const inner = parseOr();
			if (peek()?.type !== "rparen") {
				throw new SearchQueryError(
					"Unclosed parenthesis in search query",
					"unclosed-search-paren",
				);
			}
			consume();
			return inner;
		}
		if (token.type === "text") {
			consume();
			return { type: "text", value: token.value };
		}
		if (token.type === "op") {
			consume();
			validateOperator(token.name, token.value);
			return {
				type: "op",
				name: token.name,
				value: normalizeOperatorValue(token.name, token.value),
			};
		}
		throw new SearchQueryError("Invalid search query", "invalid-search-query");
	};

	if (tokens.length === 0) {
		throw new SearchQueryError("Search query is required", "search-query-required");
	}

	const ast = parseOr();
	if (pos < tokens.length) {
		throw new SearchQueryError("Invalid search query", "invalid-search-query");
	}
	return ast;
}

function validateOperator(name: string, value: string): void {
	if (name === "in") {
		if (!isInValue(value.toLowerCase())) {
			throw new SearchQueryError("Invalid search folder", "invalid-search-folder");
		}
		return;
	}
	if (name === "is") {
		if (!isIsValue(value.toLowerCase())) {
			throw new SearchQueryError("Invalid search is: value", "invalid-search-is-value");
		}
		return;
	}
	if (name === "has") {
		if (!isHasValue(value)) {
			throw new SearchQueryError("Invalid search has: value", "invalid-search-has-value");
		}
		return;
	}
	if (name === "since" || name === "until") {
		if (!isValidSearchDateValue(value)) {
			throw new SearchQueryError("Invalid search date", "invalid-search-date");
		}
	}
}

function normalizeOperatorValue(name: string, value: string): string {
	if (name === "in" || name === "is" || name === "has") {
		return value.toLowerCase();
	}
	return value;
}
