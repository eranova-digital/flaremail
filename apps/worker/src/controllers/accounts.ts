import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import type { AccountRole } from "../lib/auth/types";
import {
	assignRole,
	adminCreatePasswordResetCode,
	adminDisableAccountMfa,
	adminGetAccountMfaStatus,
	adminListAccountSessions,
	adminRevokeAccountSession,
	adminRevokeAllAccountSessions,
	getAccountDetail,
	getDomainLocalPartPolicy,
	grantSharedMailboxAccess,
	grantManagerMailboxAssignment,
	inviteAccount,
	listAccountsForPrincipal,
	listMailboxGrantHolders,
	listMailboxManagerAssignments,
	parseProfileInput,
	regenerateInviteCode,
	removeAccount,
	revokeSharedMailboxAccess,
	revokeManagerMailboxAssignment,
	suggestInviteLocalPart,
	suspendAccount,
	unsuspendAccount,
	updateAccountProfile,
	updateAccountAssignments,
	updateDomainLocalPartPolicy,
} from "../services/accounts";
import {
	parseLogContextFromRequest,
	safeEmitLog,
} from "../services/logs";

export async function handleListAccounts(context: RouteContext) {
	try {
		const items = await withDb(context.env, (db) =>
			listAccountsForPrincipal(db, context.principal),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetAccount(context: RouteContext) {
	try {
		const account = await withDb(context.env, (db) =>
			getAccountDetail(db, context.principal, context.params.id),
		);
		return jsonResponse(account);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUpdateAccount(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;

	try {
		const account = await withDb(context.env, (db) =>
			updateAccountProfile(db, context.principal, context.params.id, {
				profile:
					value.profile && typeof value.profile === "object"
						? parseProfileInput(value.profile as Record<string, unknown>)
						: undefined,
				lockedFields: Array.isArray(value.lockedFields)
					? value.lockedFields.filter(
							(field): field is string => typeof field === "string",
						)
					: undefined,
			}),
		);
		return jsonResponse(account);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleInviteAccount(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (
		typeof value.domainId !== "string" ||
		typeof value.localPart !== "string"
	) {
		return validationError(context.request, "domainId and localPart are required");
	}

	const role =
		typeof value.role === "string" ? (value.role as AccountRole) : "user";

	try {
		const result = await withDb(context.env, (db) =>
			inviteAccount(
				db,
				context.principal,
				{
					domainId: value.domainId as string,
					localPart: value.localPart as string,
					role,
					...parseProfileInput(value),
					lockedFields: Array.isArray(value.lockedFields)
						? value.lockedFields.filter(
								(field): field is string => typeof field === "string",
							)
						: undefined,
					sendInviteEmail: value.sendInviteEmail === true,
					assignedDomainIds: Array.isArray(value.assignedDomainIds)
						? value.assignedDomainIds.filter(
								(id): id is string => typeof id === "string",
							)
						: undefined,
					sharedMailboxIds: Array.isArray(value.sharedMailboxIds)
						? value.sharedMailboxIds.filter(
								(id): id is string => typeof id === "string",
							)
						: undefined,
					allSharedMailboxes: value.allSharedMailboxes === true,
				},
				{
					email: context.env.EMAIL,
					bucket: context.env.BUCKET,
				},
			),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleSuggestInviteLocalPart(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.domainId !== "string") {
		return validationError(context.request, "domainId is required");
	}

	try {
		const localPart = await withDb(context.env, (db) =>
			suggestInviteLocalPart(
				db,
				value.domainId as string,
				{
					firstName:
						typeof value.firstName === "string" ? value.firstName : undefined,
					lastName:
						typeof value.lastName === "string" ? value.lastName : undefined,
				},
				context.principal.role === "manager",
			),
		);
		return jsonResponse({ localPart });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleAssignRole(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.accountId !== "string" || typeof value.role !== "string") {
		return validationError(context.request, "accountId and role are required");
	}
	try {
		await withDb(context.env, (db) =>
			assignRole(db, context.principal, {
				accountId: value.accountId as string,
				role: value.role as AccountRole,
				domainIds: Array.isArray(value.domainIds)
					? value.domainIds.filter((id): id is string => typeof id === "string")
					: undefined,
			}),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleSuspendAccount(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			suspendAccount(db, context.principal, context.params.id),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUnsuspendAccount(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			unsuspendAccount(db, context.principal, context.params.id),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRemoveAccount(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			removeAccount(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.id,
			),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleCreatePasswordResetCode(context: RouteContext) {
	try {
		const code = await withDb(context.env, (db) =>
			adminCreatePasswordResetCode(
				db,
				context.principal,
				context.params.id,
			),
		);
		return jsonResponse({ code });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetDomainLocalPartPolicy(context: RouteContext) {
	try {
		const policy = await withDb(context.env, (db) =>
			getDomainLocalPartPolicy(db, context.params.domainId),
		);
		return jsonResponse(policy);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUpdateDomainLocalPartPolicy(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	const domainId = context.params.domainId;

	try {
		const policy = await withDb(context.env, async (db) => {
			const updated = await updateDomainLocalPartPolicy(
				db,
				context.principal,
				domainId,
				{
					enforced:
						typeof value.enforced === "boolean" ? value.enforced : undefined,
					pattern:
						value.pattern === null
							? null
							: typeof value.pattern === "string"
								? value.pattern
								: undefined,
				},
			);
			const accountId = context.principal.accountId;
			if (accountId) {
				await safeEmitLog(db, {
					importance: 5,
					type: "domains",
					summary: "{actor} updated local-part policy for {domain}",
					refs: {
						actor: { kind: "account", id: accountId },
						domain: { kind: "domain", id: domainId },
					},
					actorAccountId: accountId,
					context: parseLogContextFromRequest(context.request),
				});
			} else {
				await safeEmitLog(db, {
					importance: 5,
					type: "domains",
					summary: "Updated local-part policy for {domain}",
					refs: {
						domain: { kind: "domain", id: domainId },
					},
					actorAccountId: null,
					context: parseLogContextFromRequest(context.request),
				});
			}
			return updated;
		});
		return jsonResponse(policy);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUpdateAccountAssignments(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;

	try {
		const account = await withDb(context.env, (db) =>
			updateAccountAssignments(db, context.principal, context.params.id, {
				domainIds: Array.isArray(value.domainIds)
					? value.domainIds.filter((id): id is string => typeof id === "string")
					: undefined,
				allSharedMailboxes:
					typeof value.allSharedMailboxes === "boolean"
						? value.allSharedMailboxes
						: undefined,
				sharedMailboxIds: Array.isArray(value.sharedMailboxIds)
					? value.sharedMailboxIds.filter(
							(id): id is string => typeof id === "string",
						)
					: undefined,
				grantedMailboxIds: Array.isArray(value.grantedMailboxIds)
					? value.grantedMailboxIds.filter(
							(id): id is string => typeof id === "string",
						)
					: undefined,
			}),
		);
		return jsonResponse(account);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRegenerateInviteCode(context: RouteContext) {
	try {
		const result = await withDb(context.env, (db) =>
			regenerateInviteCode(db, context.principal, context.params.id),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleListMailboxGrantHolders(context: RouteContext) {
	try {
		const items = await withDb(context.env, (db) =>
			listMailboxGrantHolders(
				db,
				context.principal,
				context.params.mailboxId,
			),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGrantSharedMailboxAccess(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.mailboxId !== "string") {
		return validationError(context.request, "mailboxId is required");
	}

	try {
		await withDb(context.env, (db) =>
			grantSharedMailboxAccess(
				db,
				context.principal,
				context.params.id,
				value.mailboxId as string,
			),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeSharedMailboxAccess(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			revokeSharedMailboxAccess(
				db,
				context.principal,
				context.params.id,
				context.params.mailboxId,
			),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleListMailboxManagerAssignments(context: RouteContext) {
	try {
		const items = await withDb(context.env, (db) =>
			listMailboxManagerAssignments(
				db,
				context.principal,
				context.params.mailboxId,
			),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGrantManagerMailboxAssignment(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}
	const value = body as Record<string, unknown>;
	if (typeof value.mailboxId !== "string") {
		return validationError(context.request, "mailboxId is required");
	}

	try {
		await withDb(context.env, (db) =>
			grantManagerMailboxAssignment(
				db,
				context.principal,
				context.params.id,
				value.mailboxId as string,
			),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeManagerMailboxAssignment(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			revokeManagerMailboxAssignment(
				db,
				context.principal,
				context.params.id,
				context.params.mailboxId,
			),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleListAccountSessions(context: RouteContext) {
	try {
		const items = await withDb(context.env, (db) =>
			adminListAccountSessions(db, context.principal, context.params.id),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeAccountSession(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			adminRevokeAccountSession(
				db,
				context.principal,
				context.params.id,
				context.params.sessionId,
			),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleRevokeAllAccountSessions(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			adminRevokeAllAccountSessions(
				db,
				context.principal,
				context.params.id,
			),
		);
		return jsonResponse({ ok: true });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetAccountMfaStatus(context: RouteContext) {
	try {
		const status = await withDb(context.env, (db) =>
			adminGetAccountMfaStatus(db, context.principal, context.params.id),
		);
		return jsonResponse(status);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleDisableAccountMfa(context: RouteContext) {
	try {
		const status = await withDb(context.env, (db) =>
			adminDisableAccountMfa(db, context.principal, context.params.id),
		);
		return jsonResponse(status);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
