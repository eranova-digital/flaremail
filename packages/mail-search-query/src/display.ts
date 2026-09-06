import { SearchQueryError } from "./error";
import { lexSearchQuery, type LexToken } from "./lex";
import { parseSearchQuery } from "./parse";

export type SearchDisplayToken =
	| { type: "and" }
	| { type: "or" }
	| { type: "not" }
	| { type: "lparen" }
	| { type: "rparen" }
	| { type: "text"; value: string }
	| { type: "op"; name: string; value: string; negated: boolean };

export type SearchFieldModel =
	| { valid: false; draft: string }
	| { valid: true; tokens: SearchDisplayToken[]; draft: string };

export function formatOperatorSource(name: string, value: string): string {
	if (/[\s"]/.test(value) || value.length === 0) {
		return `${name}:"${value}"`;
	}
	return `${name}:${value}`;
}

export function serializeDisplayTokens(
	tokens: SearchDisplayToken[],
	draft = "",
): string {
	let out = "";
	const append = (piece: string, glue: "space" | "tight") => {
		if (!piece) {
			return;
		}
		if (!out || glue === "tight" || out.endsWith("(") || out.endsWith("-")) {
			out += piece;
			return;
		}
		out += ` ${piece}`;
	};

	for (const token of tokens) {
		switch (token.type) {
			case "and":
				append("&&", "space");
				break;
			case "or":
				append("||", "space");
				break;
			case "not":
				append("-", "space");
				break;
			case "lparen":
				append("(", out.endsWith("-") ? "tight" : "space");
				break;
			case "rparen":
				append(")", "tight");
				break;
			case "text":
				append(/\s/.test(token.value) ? `"${token.value}"` : token.value, "space");
				break;
			case "op":
				append(
					`${token.negated ? "-" : ""}${formatOperatorSource(token.name, token.value)}`,
					"space",
				);
				break;
		}
	}
	if (draft) {
		append(draft, out.endsWith("-") ? "tight" : "space");
	}
	return out;
}

export function tokenSource(token: LexToken): string {
	switch (token.type) {
		case "and":
			return "&&";
		case "or":
			return "||";
		case "not":
			return "-";
		case "lparen":
			return "(";
		case "rparen":
			return ")";
		case "text":
			return /\s/.test(token.value) ? `"${token.value}"` : token.value;
		case "op":
			return formatOperatorSource(token.name, token.value);
	}
}

export function operatorTokenSource(token: Extract<SearchDisplayToken, { type: "op" }>): string {
	return `${token.negated ? "-" : ""}${formatOperatorSource(token.name, token.value)}`;
}

/**
 * Only operator terms become pills. Consecutive plain-text words stay one run.
 * The trailing token stays in the input while editing; pass `commitTrailingOp`
 * after blur so a completed `from:x` at the end becomes a pill.
 */
export function splitSearchField(
	query: string,
	options: { commitTrailingOp?: boolean } = {},
): SearchFieldModel {
	if (!query.trim()) {
		return { valid: true, tokens: [], draft: query };
	}

	try {
		parseSearchQuery(query);
	} catch (error) {
		if (error instanceof SearchQueryError) {
			return { valid: false, draft: query };
		}
		throw error;
	}

	const tokens = mergeTextTokens(toDisplayTokens(lexSearchQuery(query.trimStart())));
	const trailingSpace = /\s$/.test(query);
	if (tokens.length === 0) {
		return { valid: true, tokens: [], draft: query };
	}

	const onlyText = tokens.every((token) => token.type === "text");
	if (onlyText) {
		return { valid: true, tokens: [], draft: query };
	}

	const last = tokens[tokens.length - 1]!;
	if (last.type === "text" && !trailingSpace) {
		return {
			valid: true,
			tokens: tokens.slice(0, -1),
			draft: last.value,
		};
	}

	const commitOp = trailingSpace || options.commitTrailingOp === true;
	if (last.type === "op" && !commitOp) {
		return {
			valid: true,
			tokens: tokens.slice(0, -1),
			draft: operatorTokenSource(last),
		};
	}

	return { valid: true, tokens, draft: "" };
}

function mergeTextTokens(tokens: SearchDisplayToken[]): SearchDisplayToken[] {
	const out: SearchDisplayToken[] = [];
	for (const token of tokens) {
		const prev = out[out.length - 1];
		if (token.type === "text" && prev?.type === "text") {
			out[out.length - 1] = {
				type: "text",
				value: `${prev.value} ${token.value}`,
			};
			continue;
		}
		out.push(token);
	}
	return out;
}

function toDisplayTokens(tokens: LexToken[]): SearchDisplayToken[] {
	const out: SearchDisplayToken[] = [];
	for (let i = 0; i < tokens.length; i += 1) {
		const token = tokens[i]!;
		if (token.type === "not" && tokens[i + 1]?.type === "op") {
			const op = tokens[i + 1]!;
			if (op.type === "op") {
				out.push({ type: "op", name: op.name, value: op.value, negated: true });
				i += 1;
				continue;
			}
		}
		if (token.type === "op") {
			out.push({
				type: "op",
				name: token.name,
				value: token.value,
				negated: false,
			});
			continue;
		}
		out.push(token);
	}
	return out;
}
