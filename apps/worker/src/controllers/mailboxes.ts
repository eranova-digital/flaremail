import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import type { MailboxType, UserCreatableMailboxType } from "../lib/mailbox-types";
import { USER_CREATABLE_MAILBOX_TYPES } from "../lib/mailbox-types";
import {
	createMailbox,
	getMailbox,
	listMailboxes,
	removeMailbox,
	updateMailbox,
} from "../services/mailboxes";

export async function handleListMailboxes({
	request,
	env,
	principal,
}: RouteContext): Promise<Response> {
	try {
		const items = await withDb(env, async (db) => {
			const all = await listMailboxes(db);
			const { filterMailboxesForPrincipal } = await import("../services/accounts");
			return filterMailboxesForPrincipal(db, principal, all);
		});
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateMailbox({
	request,
	env,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;
	if (typeof value.address !== "string" || !value.address.trim()) {
		return validationError(request, "Field 'address' is required");
	}
	if (typeof value.domainId !== "string" || !value.domainId.trim()) {
		return validationError(request, "Field 'domainId' is required");
	}
	if (
		typeof value.type !== "string" ||
		!USER_CREATABLE_MAILBOX_TYPES.includes(value.type as UserCreatableMailboxType)
	) {
		return validationError(request, "Field 'type' is invalid");
	}

	try {
		const mailbox = await withDb(env, (db) =>
			createMailbox(db, {
				address: value.address as string,
				domainId: value.domainId as string,
				type: value.type as MailboxType,
				aliasTargetId:
					typeof value.aliasTargetId === "string"
						? value.aliasTargetId
						: undefined,
				aliasTargetAddress:
					typeof value.aliasTargetAddress === "string"
						? value.aliasTargetAddress
						: undefined,
			}),
		);
		return jsonResponse(mailbox, 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleGetMailbox({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		const mailbox = await withDb(env, (db) => getMailbox(db, params.id));
		return jsonResponse(mailbox);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleUpdateMailbox({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;

	try {
		const mailbox = await withDb(env, (db) =>
			updateMailbox(db, params.id, {
				isActive:
					typeof value.isActive === "boolean" ? value.isActive : undefined,
			}),
		);
		return jsonResponse(mailbox);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleDeleteMailbox({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		await withDb(env, (db) => removeMailbox(db, env.BUCKET, params.id));
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, request);
	}
}
