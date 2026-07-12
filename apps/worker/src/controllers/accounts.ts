import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	assignRole,
	inviteAccount,
	listAccountsForPrincipal,
	suspendAccount,
} from "../services/accounts";
import { createPasswordResetCode } from "../services/auth";
import type { AccountRole } from "../lib/auth/types";

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
	try {
		const result = await withDb(context.env, (db) =>
			inviteAccount(db, context.principal, {
				domainId: value.domainId as string,
				localPart: value.localPart as string,
				firstName:
					typeof value.firstName === "string" ? value.firstName : undefined,
				lastName: typeof value.lastName === "string" ? value.lastName : undefined,
				recoveryAddress:
					typeof value.recoveryAddress === "string"
						? value.recoveryAddress
						: undefined,
				sendInviteEmail: value.sendInviteEmail === true,
			}),
		);
		return jsonResponse(result);
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

export async function handleCreatePasswordResetCode(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}
	try {
		const code = await withDb(context.env, (db) =>
			createPasswordResetCode(db, {
				accountId: context.params.id,
				createdByAccountId: context.principal.accountId!,
			}),
		);
		return jsonResponse({ code });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
