import {
	and,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lt,
	lte,
	or,
	sql,
	type SQL,
} from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountProfiles,
	accounts,
	apiKeys,
	domains,
	identities,
	invites,
	logs,
	mailboxes,
	messages,
	oidcClients,
	threads,
} from "../db/schema";
import { toProfilePicturePayload } from "../lib/profile-picture/payload";
import type { LogContext } from "../lib/logs/context";
import { emitLog, safeEmitLog } from "../lib/logs/emit";
import {
	LOG_REF_KINDS,
	LOG_TYPES,
	type EmitLogInput,
	type LogRef,
	type LogRefKind,
	type LogRefs,
	type LogType,
} from "../lib/logs/types";
import { getInstanceSettings } from "./instance-settings";

export {
	LOG_REF_KINDS,
	LOG_TYPES,
	emitLog,
	safeEmitLog,
	type EmitLogInput,
	type LogContext,
	type LogRef,
	type LogRefKind,
	type LogRefs,
	type LogType,
};

export type ResolvedAccountRef = {
	kind: "account";
	id: string;
	displayName: string;
	loginIdentifier: string;
	profilePicture: ReturnType<typeof toProfilePicturePayload>;
	deleted: boolean;
};

export type ResolvedGenericRef = {
	kind: Exclude<LogRefKind, "account">;
	id: string;
	label: string;
	deleted: boolean;
};

export type ResolvedRef = ResolvedAccountRef | ResolvedGenericRef;

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

export type ListLogsInput = {
	q?: string;
	types?: LogType[];
	maxImportance?: number;
	minImportance?: number;
	from?: Date;
	to?: Date;
	limit?: number;
	before?: string;
	/** Match logs where this account is the actor or appears in refs. */
	accountId?: string;
};

export function isLogType(value: unknown): value is LogType {
	return typeof value === "string" && (LOG_TYPES as readonly string[]).includes(value);
}

export { parseLogContextFromRequest } from "../lib/logs/request-context";

export async function purgeExpiredLogs(db: Database): Promise<number> {
	const settings = await getInstanceSettings(db);
	const days = Number(settings.logRetentionDays);
	if (!Number.isFinite(days) || days <= 0) {
		return 0;
	}

	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	const deleted = await db
		.delete(logs)
		.where(lte(logs.createdAt, cutoff))
		.returning({ id: logs.id });

	return deleted.length;
}

export async function listLogs(
	db: Database,
	input: ListLogsInput = {},
): Promise<{ items: LogListItem[]; nextBefore: string | null }> {
	const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
	const conditions: SQL[] = [];

	if (input.types && input.types.length > 0) {
		conditions.push(inArray(logs.type, input.types));
	}
	if (input.maxImportance !== undefined) {
		conditions.push(lte(logs.importance, input.maxImportance));
	}
	if (input.minImportance !== undefined) {
		conditions.push(gte(logs.importance, input.minImportance));
	}
	if (input.from) {
		conditions.push(gte(logs.createdAt, input.from));
	}
	if (input.to) {
		conditions.push(lte(logs.createdAt, input.to));
	}
	if (input.before) {
		const beforeDate = new Date(input.before);
		if (!Number.isNaN(beforeDate.getTime())) {
			conditions.push(lt(logs.createdAt, beforeDate));
		}
	}
	if (input.q?.trim()) {
		const pattern = `%${input.q.trim()}%`;
		conditions.push(
			or(
				ilike(logs.summary, pattern),
				ilike(logs.refs, pattern),
				ilike(logs.context, pattern),
			)!,
		);
	}
	if (input.accountId) {
		const accountId = input.accountId;
		conditions.push(
			or(
				eq(logs.actorAccountId, accountId),
				sql`EXISTS (
					SELECT 1
					FROM jsonb_each((${logs.refs})::jsonb) AS ref
					WHERE ref.value->>'kind' = 'account'
						AND ref.value->>'id' = ${accountId}
				)`,
			)!,
		);
	}

	const rows = await db
		.select()
		.from(logs)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(logs.createdAt), desc(logs.id))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	const hasMore = rows.length > limit;
	const nextBefore = hasMore
		? (page[page.length - 1]?.createdAt.toISOString() ?? null)
		: null;

	const accountIds = new Set<string>();
	const mailboxIds = new Set<string>();
	const threadIds = new Set<string>();
	const messageIds = new Set<string>();
	const domainIds = new Set<string>();
	const identityIds = new Set<string>();
	const inviteIds = new Set<string>();
	const oidcClientIds = new Set<string>();
	const apiKeyIds = new Set<string>();

	const parsedRefsByRow = page.map((row) => parseRefs(row.refs));

	for (const row of page) {
		if (row.actorAccountId) {
			accountIds.add(row.actorAccountId);
		}
	}
	for (const parsed of parsedRefsByRow) {
		for (const ref of Object.values(parsed)) {
			switch (ref.kind) {
				case "account":
					accountIds.add(ref.id);
					break;
				case "mailbox":
					mailboxIds.add(ref.id);
					break;
				case "thread":
					threadIds.add(ref.id);
					break;
				case "message":
					messageIds.add(ref.id);
					break;
				case "domain":
					domainIds.add(ref.id);
					break;
				case "identity":
					identityIds.add(ref.id);
					break;
				case "invite":
					inviteIds.add(ref.id);
					break;
				case "oidc-client":
					oidcClientIds.add(ref.id);
					break;
				case "api-key":
					apiKeyIds.add(ref.id);
					break;
			}
		}
	}

	const [
		accountMap,
		mailboxLabels,
		threadLabels,
		messageLabels,
		domainLabels,
		identityLabels,
		inviteLabels,
		oidcLabels,
		apiKeyLabels,
	] = await Promise.all([
		loadAccountMap(db, [...accountIds]),
		loadMailboxLabels(db, [...mailboxIds]),
		loadThreadLabels(db, [...threadIds]),
		loadMessageLabels(db, [...messageIds]),
		loadDomainLabels(db, [...domainIds]),
		loadIdentityLabels(db, [...identityIds]),
		loadInviteLabels(db, [...inviteIds]),
		loadOidcClientLabels(db, [...oidcClientIds]),
		loadApiKeyLabels(db, [...apiKeyIds]),
	]);

	const labelMaps: Record<
		Exclude<LogRefKind, "account" | "external-address">,
		Map<string, string>
	> = {
		mailbox: mailboxLabels,
		thread: threadLabels,
		message: messageLabels,
		domain: domainLabels,
		identity: identityLabels,
		invite: inviteLabels,
		"oidc-client": oidcLabels,
		"api-key": apiKeyLabels,
	};

	const items = page.map((row, index) =>
		toListItem(row, parsedRefsByRow[index]!, accountMap, labelMaps),
	);

	return { items, nextBefore };
}

function parseRefs(raw: string): LogRefs {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const out: LogRefs = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (
				value &&
				typeof value === "object" &&
				!Array.isArray(value) &&
				typeof (value as LogRef).kind === "string" &&
				typeof (value as LogRef).id === "string" &&
				(LOG_REF_KINDS as readonly string[]).includes((value as LogRef).kind)
			) {
				out[key] = {
					kind: (value as LogRef).kind,
					id: (value as LogRef).id,
				};
			}
		}
		return out;
	} catch {
		return {};
	}
}

function parseContext(raw: string | null): LogContext | null {
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as LogContext;
		return {
			ip: typeof parsed.ip === "string" ? parsed.ip : undefined,
			userAgent:
				typeof parsed.userAgent === "string" ? parsed.userAgent : undefined,
			method: typeof parsed.method === "string" ? parsed.method : undefined,
			path: typeof parsed.path === "string" ? parsed.path : undefined,
		};
	} catch {
		return null;
	}
}

async function loadAccountMap(
	db: Database,
	accountIds: string[],
): Promise<Map<string, ResolvedAccountRef>> {
	const map = new Map<string, ResolvedAccountRef>();
	if (accountIds.length === 0) {
		return map;
	}

	const rows = await db
		.select({
			accountId: accounts.id,
			loginIdentifier: accounts.loginIdentifier,
			firstName: accountProfiles.firstName,
			lastName: accountProfiles.lastName,
			profilePictureUpdatedAt: accountProfiles.profilePictureUpdatedAt,
		})
		.from(accounts)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.where(inArray(accounts.id, accountIds));

	for (const row of rows) {
		map.set(row.accountId, {
			kind: "account",
			id: row.accountId,
			loginIdentifier: row.loginIdentifier,
			displayName:
				[row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
				row.loginIdentifier,
			profilePicture: toProfilePicturePayload(row.profilePictureUpdatedAt),
			deleted: false,
		});
	}

	return map;
}

async function loadMailboxLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({ id: mailboxes.id, address: mailboxes.address })
		.from(mailboxes)
		.where(inArray(mailboxes.id, ids));
	return new Map(rows.map((r) => [r.id, r.address]));
}

async function loadThreadLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({ id: threads.id, subject: threads.subject })
		.from(threads)
		.where(inArray(threads.id, ids));
	return new Map(rows.map((r) => [r.id, r.subject || "(no subject)"]));
}

async function loadMessageLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({ id: messages.id, subject: messages.subject })
		.from(messages)
		.where(inArray(messages.id, ids));
	return new Map(rows.map((r) => [r.id, r.subject || "(no subject)"]));
}

async function loadDomainLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({ id: domains.id, name: domains.name })
		.from(domains)
		.where(inArray(domains.id, ids));
	return new Map(rows.map((r) => [r.id, r.name]));
}

async function loadIdentityLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({
			id: identities.id,
			namePattern: identities.namePattern,
			customName: identities.customName,
		})
		.from(identities)
		.where(inArray(identities.id, ids));
	return new Map(
		rows.map((r) => [r.id, r.customName?.trim() || r.namePattern || r.id]),
	);
}

async function loadInviteLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({
			id: invites.id,
			loginIdentifier: accounts.loginIdentifier,
		})
		.from(invites)
		.innerJoin(accounts, eq(accounts.id, invites.accountId))
		.where(inArray(invites.id, ids));
	return new Map(rows.map((r) => [r.id, r.loginIdentifier]));
}

async function loadOidcClientLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({ id: oidcClients.id, name: oidcClients.name })
		.from(oidcClients)
		.where(inArray(oidcClients.id, ids));
	return new Map(rows.map((r) => [r.id, r.name]));
}

async function loadApiKeyLabels(db: Database, ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db
		.select({ id: apiKeys.id, name: apiKeys.name })
		.from(apiKeys)
		.where(inArray(apiKeys.id, ids));
	return new Map(rows.map((r) => [r.id, r.name || r.id]));
}

function resolveAccountRef(
	id: string,
	accountMap: Map<string, ResolvedAccountRef>,
): ResolvedAccountRef {
	return (
		accountMap.get(id) ?? {
			kind: "account",
			id,
			displayName: "Deleted account",
			loginIdentifier: id,
			profilePicture: toProfilePicturePayload(null),
			deleted: true,
		}
	);
}

function deletedLabel(kind: Exclude<LogRefKind, "account" | "external-address">): string {
	switch (kind) {
		case "mailbox":
			return "Deleted mailbox";
		case "thread":
			return "Deleted thread";
		case "message":
			return "Deleted message";
		case "domain":
			return "Deleted domain";
		case "identity":
			return "Deleted identity";
		case "invite":
			return "Deleted invite";
		case "oidc-client":
			return "Deleted OIDC client";
		case "api-key":
			return "Deleted API key";
	}
}

function toListItem(
	row: typeof logs.$inferSelect,
	rawRefs: LogRefs,
	accountMap: Map<string, ResolvedAccountRef>,
	labelMaps: Record<
		Exclude<LogRefKind, "account" | "external-address">,
		Map<string, string>
	>,
): LogListItem {
	const resolved: Record<string, ResolvedRef> = {};
	for (const [key, ref] of Object.entries(rawRefs)) {
		if (ref.kind === "account") {
			resolved[key] = resolveAccountRef(ref.id, accountMap);
			continue;
		}
		if (ref.kind === "external-address") {
			resolved[key] = {
				kind: "external-address",
				id: ref.id,
				label: ref.id,
				deleted: false,
			};
			continue;
		}
		const label = labelMaps[ref.kind].get(ref.id);
		resolved[key] = label
			? { kind: ref.kind, id: ref.id, label, deleted: false }
			: {
					kind: ref.kind,
					id: ref.id,
					label: deletedLabel(ref.kind),
					deleted: true,
				};
	}

	return {
		id: row.id,
		importance: row.importance,
		type: row.type,
		summary: row.summary,
		refs: resolved,
		actor: row.actorAccountId
			? resolveAccountRef(row.actorAccountId, accountMap)
			: null,
		context: parseContext(row.context),
		createdAt: row.createdAt.toISOString(),
	};
}
