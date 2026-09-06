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

/**
 * Operator terms become pills once a delimiter (space / && / || / paren)
 * commits them. The trailing token stays draft text so `from:ali` can be finished.
 */
export function splitSearchField(query: string): SearchFieldModel {
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

	const tokens = lexSearchQuery(query.trimStart());
	const leading = query.match(/^\s*/)?.[0] ?? "";
	const trailingSpace = /\s$/.test(query);
	if (trailingSpace || tokens.length === 0) {
		return {
			valid: true,
			tokens: toDisplayTokens(tokens),
			draft: trailingSpace ? "" : query,
		};
	}

	let cut = tokens.length;
	if (tokens[cut - 1]?.type === "op" || tokens[cut - 1]?.type === "text") {
		cut -= 1;
		if (tokens[cut - 1]?.type === "not") {
			cut -= 1;
		}
	}

	const committed = tokens.slice(0, cut);
	const draftTokens = tokens.slice(cut);
	const draft = draftTokens.map(tokenSource).join("");
	return {
		valid: true,
		tokens: toDisplayTokens(committed),
		draft: leading && committed.length === 0 ? leading + draft : draft,
	};
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
			out.push({ type: "op", name: token.name, value: token.value, negated: false });
			continue;
		}
		out.push(token);
	}
	return out;
}
