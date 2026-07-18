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
	listAvailableIdentitiesForSend,
	listMailboxIdentities,
	parseIdentityNamePattern,
	updateMailboxIdentity,
} from "../services/identities";

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

export async function handleListMailboxIdentities(context: RouteContext) {
	try {
		const items = await withDb(context.env, (db) =>
			listMailboxIdentities(db, context.principal, context.params.mailboxId),
		);
		return jsonResponse({ items });
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
		const identity = await withDb(context.env, (db) =>
			createMailboxIdentity(db, context.principal, mailboxId, {
				namePattern,
				customName: parsed.customName,
				signatureHtml: parsed.signatureHtml,
			}),
		);
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
		const identity = await withDb(context.env, (db) =>
			updateMailboxIdentity(db, context.principal, identityId, {
				namePattern: parsed.namePattern,
				customName: parsed.customName,
				signatureHtml: parsed.signatureHtml,
			}),
		);
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
		await withDb(context.env, (db) =>
			deleteMailboxIdentity(db, context.principal, context.params.id),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		if (error instanceof IdentityAccessDeniedError) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}
