import { SearchQueryError } from "./error";
import { isSearchOperator } from "./operators";

export type LexToken =
	| { type: "and" }
	| { type: "or" }
	| { type: "not" }
	| { type: "lparen" }
	| { type: "rparen" }
	| { type: "text"; value: string }
	| { type: "op"; name: string; value: string };

export function lexSearchQuery(input: string): LexToken[] {
	const tokens: LexToken[] = [];
	let i = 0;
	const n = input.length;

	const skipWs = () => {
		while (i < n && isSpace(input[i]!)) {
			i += 1;
		}
	};

	while (i < n) {
		skipWs();
		if (i >= n) {
			break;
		}

		if (input.startsWith("&&", i)) {
			tokens.push({ type: "and" });
			i += 2;
			continue;
		}
		if (input.startsWith("||", i)) {
			tokens.push({ type: "or" });
			i += 2;
			continue;
		}
		if (input[i] === "(") {
			tokens.push({ type: "lparen" });
			i += 1;
			continue;
		}
		if (input[i] === ")") {
			tokens.push({ type: "rparen" });
			i += 1;
			continue;
		}
		if (input[i] === "-" && isUnaryMinus(input, i)) {
			tokens.push({ type: "not" });
			i += 1;
			continue;
		}
		if (input[i] === '"') {
			tokens.push({ type: "text", value: readQuoted(input, () => i, (next) => { i = next; }) });
			continue;
		}

		const start = i;
		while (
			i < n &&
			input[i] !== ":" &&
			input[i] !== '"' &&
			!isSpace(input[i]!) &&
			!isDelimAt(input, i)
		) {
			i += 1;
		}
		const name = input.slice(start, i);
		if (i < n && input[i] === ":") {
			if (!name) {
				throw new SearchQueryError("Invalid search query", "invalid-search-query");
			}
			const lower = name.toLowerCase();
			if (!isSearchOperator(lower)) {
				throw new SearchQueryError("Unknown search operator", "unknown-search-operator");
			}
			i += 1;
			let value: string;
			if (i < n && input[i] === '"') {
				value = readQuoted(input, () => i, (next) => { i = next; });
			} else {
				const valueStart = i;
				while (i < n && !isSpace(input[i]!) && !isDelimAt(input, i)) {
					i += 1;
				}
				value = input.slice(valueStart, i);
			}
			if (!value) {
				throw new SearchQueryError(
					"Empty search operator value",
					"empty-search-operator-value",
				);
			}
			tokens.push({ type: "op", name: lower, value });
			continue;
		}

		if (!name) {
			throw new SearchQueryError("Invalid search query", "invalid-search-query");
		}
		tokens.push({ type: "text", value: name });
	}

	return tokens;
}

function isSpace(ch: string): boolean {
	return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isDelimAt(input: string, i: number): boolean {
	return (
		input.startsWith("&&", i) ||
		input.startsWith("||", i) ||
		input[i] === "(" ||
		input[i] === ")"
	);
}

function isUnaryMinus(input: string, i: number): boolean {
	const next = input[i + 1];
	if (!next || isSpace(next)) {
		return false;
	}
	return next === '"' || next === "(" || next === "-" || /[a-zA-Z0-9]/.test(next);
}

function readQuoted(
	input: string,
	getI: () => number,
	setI: (next: number) => void,
): string {
	let i = getI() + 1;
	let out = "";
	while (i < input.length && input[i] !== '"') {
		out += input[i];
		i += 1;
	}
	if (i >= input.length) {
		throw new SearchQueryError("Unclosed quote in search query", "unclosed-search-quote");
	}
	setI(i + 1);
	return out;
}
