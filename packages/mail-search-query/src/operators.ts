export const MESSAGE_OPERATORS = [
	"from",
	"to",
	"cc",
	"bcc",
	"subject",
	"since",
	"until",
	"has",
] as const;

export const THREAD_OPERATORS = ["in", "label", "is"] as const;

export const SEARCH_OPERATORS = [
	...MESSAGE_OPERATORS,
	...THREAD_OPERATORS,
] as const;

export type MessageOperator = (typeof MESSAGE_OPERATORS)[number];
export type ThreadOperator = (typeof THREAD_OPERATORS)[number];
export type SearchOperator = (typeof SEARCH_OPERATORS)[number];

export const IN_VALUES = [
	"inbox",
	"sent",
	"archived",
	"trash",
	"spam",
	"drafts",
	"any",
] as const;

export const IS_VALUES = ["read", "unread", "starred"] as const;

export const HAS_KINDS = ["attachment", "image", "document"] as const;

export type InValue = (typeof IN_VALUES)[number];
export type IsValue = (typeof IS_VALUES)[number];
export type HasKind = (typeof HAS_KINDS)[number];

const OPERATOR_SET = new Set<string>(SEARCH_OPERATORS);
const MESSAGE_SET = new Set<string>(MESSAGE_OPERATORS);
const THREAD_SET = new Set<string>(THREAD_OPERATORS);
const IN_SET = new Set<string>(IN_VALUES);
const IS_SET = new Set<string>(IS_VALUES);
const HAS_KIND_SET = new Set<string>(HAS_KINDS);

export function isSearchOperator(name: string): name is SearchOperator {
	return OPERATOR_SET.has(name);
}

export function isMessageOperator(name: string): name is MessageOperator {
	return MESSAGE_SET.has(name);
}

export function isThreadOperator(name: string): name is ThreadOperator {
	return THREAD_SET.has(name);
}

export function isInValue(value: string): value is InValue {
	return IN_SET.has(value);
}

export function isIsValue(value: string): value is IsValue {
	return IS_SET.has(value);
}

export function isHasKind(value: string): value is HasKind {
	return HAS_KIND_SET.has(value);
}

/** `has:.pdf` / `has:.txt` — leading dot required. */
export function isHasExtension(value: string): boolean {
	return /^\.[a-z0-9][a-z0-9._-]*$/i.test(value);
}

export function isHasValue(value: string): boolean {
	return isHasKind(value.toLowerCase()) || isHasExtension(value);
}
