import type { LogContext } from "./context";

export const LOG_TYPES = [
	"auth",
	"accounts",
	"invites",
	"mailboxes",
	"mailing",
	"threads",
	"messages",
	"identities",
	"domains",
	"settings",
	"oidc",
	"api-keys",
] as const;

export type LogType = (typeof LOG_TYPES)[number];

export const LOG_REF_KINDS = [
	"account",
	"mailbox",
	"thread",
	"message",
	"domain",
	"identity",
	"invite",
	"oidc-client",
	"api-key",
	"external-address",
] as const;

export type LogRefKind = (typeof LOG_REF_KINDS)[number];

export type LogRef = {
	kind: LogRefKind;
	id: string;
};

export type LogRefs = Record<string, LogRef>;

export type EmitLogInput = {
	importance: number;
	type: LogType;
	summary: string;
	refs?: LogRefs;
	actorAccountId?: string | null;
	context?: LogContext | null;
};
