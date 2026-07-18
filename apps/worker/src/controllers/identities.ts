import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	createMailboxIdentity,
	deleteMailboxIdentity,
	IdentityAccessDeniedError,
	IdentityValidationError,
	listAccountIdentitiesOverview,
	listAccountIdentitiesOverviewForAccount,
	listAvailableIdentitiesForSend,
	listMailboxIdentities,
	parseIdentityNamePattern,
	updateMailboxIdentity,
} from "../services/identities";
import {
	parseLogContextFromRequest,
	safeEmitLog,
} from "../services/logs";

function parseIdentityBody(value: Record<string, unknown>):
	| { error: string }
	| {
			namePattern: ReturnType<typeof parseIdentityNamePattern>;
			customName: string | null | undefined;
			signatureHtml: string | null | undefined;
	  } {
	const namePattern = parseIdentityNamePattern(value.namePattern);
	if (value.namePattern !== undefined && namePattern === undefined) {
		return { error: "namePattern is invalid" };
	}
	return {
		namePattern,
		customName:
			value.customName === undefined
				? undefined
				: value.customName === null
					? null
					: String(value.customName),
		signatureHtml:
			value.signatureHtml === undefined
				? undefined
				: value.signatureHtml === null
					? null
					: String(value.signatureHtml),
	};
}

export async function handleListAccountIdentities(context: RouteContext) {
	try {
		const result = await withDb(context.env, (db) =>
			listAccountIdentitiesOverview(db, context.principal),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleListAccountIdentitiesForAccount(
	context: RouteContext,
) {
	try {
		const result = await withDb(context.env, (db) =>
			listAccountIdentitiesOverviewForAccount(
				db,
				context.principal,
				context.params.id,
			),
		);
		return jsonResponse(result);
	} catch (error) {
		if (error instanceof IdentityAccessDeniedError) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}

export async function handleListMailboxIdentities(context: RouteContext) {
	try {
		const result = await withDb(context.env, (db) =>
			listMailboxIdentities(db, context.principal, context.params.mailboxId),
		);
		return jsonResponse(result);
	} catch (error) {
		if (error instanceof IdentityAccessDeniedError) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}

export async function handleListAvailableIdentities(context: RouteContext) {
	try {
		const items = await withDb(context.env, (db) =>
			listAvailableIdentitiesForSend(
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

export async function handleCreateMailboxIdentity(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}

	const parsed = parseIdentityBody(body as Record<string, unknown>);
	if ("error" in parsed) {
		return validationError(context.request, parsed.error);
	}
	if (!parsed.namePattern) {
		return validationError(context.request, "namePattern is required");
	}

	const mailboxId = context.params.mailboxId;
	if (!mailboxId) {
		return validationError(context.request, "mailboxId is required");
	}

	const namePattern = parsed.namePattern;

	try {
		const identity = await withDb(context.env, async (db) => {
			const created = await createMailboxIdentity(
				db,
				context.principal,
				mailboxId,
				{
					namePattern,
					customName: parsed.customName,
					signatureHtml: parsed.signatureHtml,
				},
			);
			const accountId = context.principal.accountId;
			if (accountId) {
				await safeEmitLog(db, {
					importance: 6,
					type: "identities",
					summary: "{actor} created {identity}",
					refs: {
						actor: { kind: "account", id: accountId },
						identity: { kind: "identity", id: created.id },
						mailbox: { kind: "mailbox", id: mailboxId },
					},
					actorAccountId: accountId,
					context: parseLogContextFromRequest(context.request),
				});
			}
			return created;
		});
		return jsonResponse(identity, 201);
	} catch (error) {
		if (
			error instanceof IdentityAccessDeniedError ||
			error instanceof IdentityValidationError
		) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}

export async function handleUpdateMailboxIdentity(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}

	const parsed = parseIdentityBody(body as Record<string, unknown>);
	if ("error" in parsed) {
		return validationError(context.request, parsed.error);
	}

	if (
		parsed.namePattern === undefined &&
		parsed.customName === undefined &&
		parsed.signatureHtml === undefined
	) {
		return validationError(context.request, "No valid fields were provided");
	}

	const identityId = context.params.id;
	if (!identityId) {
		return validationError(context.request, "Identity id is required");
	}

	try {
		const identity = await withDb(context.env, async (db) => {
			const updated = await updateMailboxIdentity(
				db,
				context.principal,
				identityId,
				{
					namePattern: parsed.namePattern,
					customName: parsed.customName,
					signatureHtml: parsed.signatureHtml,
				},
			);
			const accountId = context.principal.accountId;
			if (accountId) {
				await safeEmitLog(db, {
					importance: 6,
					type: "identities",
					summary: "{actor} updated {identity}",
					refs: {
						actor: { kind: "account", id: accountId },
						identity: { kind: "identity", id: updated.id },
						...(updated.mailboxId
							? { mailbox: { kind: "mailbox" as const, id: updated.mailboxId } }
							: {}),
					},
					actorAccountId: accountId,
					context: parseLogContextFromRequest(context.request),
				});
			}
			return updated;
		});
		return jsonResponse(identity);
	} catch (error) {
		if (
			error instanceof IdentityAccessDeniedError ||
			error instanceof IdentityValidationError
		) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}

export async function handleDeleteMailboxIdentity(context: RouteContext) {
	try {
		await withDb(context.env, async (db) => {
			const identityId = context.params.id;
			await deleteMailboxIdentity(db, context.principal, identityId);
			const accountId = context.principal.accountId;
			if (accountId) {
				await safeEmitLog(db, {
					importance: 6,
					type: "identities",
					summary: "{actor} deleted {identity}",
					refs: {
						actor: { kind: "account", id: accountId },
						identity: { kind: "identity", id: identityId },
					},
					actorAccountId: accountId,
					context: parseLogContextFromRequest(context.request),
				});
			}
		});
		return new Response(null, { status: 204 });
	} catch (error) {
		if (error instanceof IdentityAccessDeniedError) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}
