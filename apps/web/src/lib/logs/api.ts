import { apiRequest } from "@/lib/api/request";

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

export type ProfilePicturePayload = {
	updatedAt: string;
} | null;

export type ResolvedAccountRef = {
	kind: "account";
	id: string;
	displayName: string;
	loginIdentifier: string;
	profilePicture: ProfilePicturePayload;
	deleted: boolean;
};

export type ResolvedGenericRef = {
	kind: Exclude<
		| "mailbox"
		| "thread"
		| "message"
		| "domain"
		| "identity"
		| "invite"
		| "oidc-client"
		| "api-key"
		| "external-address",
		never
	>;
	id: string;
	label: string;
	deleted: boolean;
};

export type ResolvedRef = ResolvedAccountRef | ResolvedGenericRef;

export type LogContext = {
	ip?: string;
	userAgent?: string;
	method?: string;
	path?: string;
};

export type LogListItem = {
	id: string;
	importance: number;
	type: LogType;
	summary: string;
	refs: Record<string, ResolvedRef>;
	actor: ResolvedAccountRef | null;
	context: LogContext | null;
	createdAt: string;
};

export type ListLogsResponse = {
	items: LogListItem[];
	nextBefore: string | null;
};

export type ListLogsParams = {
	q?: string;
	types?: LogType[];
	maxImportance?: number;
	minImportance?: number;
	from?: string;
	to?: string;
	limit?: number;
	before?: string;
	accountId?: string;
};

export async function fetchLogs(
	params: ListLogsParams = {},
): Promise<ListLogsResponse> {
	const search = new URLSearchParams();
	if (params.q) search.set("q", params.q);
	if (params.types) {
		for (const type of params.types) {
			search.append("type", type);
		}
	}
	if (params.maxImportance !== undefined) {
		search.set("maxImportance", String(params.maxImportance));
	}
	if (params.minImportance !== undefined) {
		search.set("minImportance", String(params.minImportance));
	}
	if (params.from) search.set("from", params.from);
	if (params.to) search.set("to", params.to);
	if (params.limit !== undefined) search.set("limit", String(params.limit));
	if (params.before) search.set("before", params.before);
	if (params.accountId) search.set("accountId", params.accountId);

	const qs = search.toString();
	return apiRequest<ListLogsResponse>(`/logs${qs ? `?${qs}` : ""}`);
}
