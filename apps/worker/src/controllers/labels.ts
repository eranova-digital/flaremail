import { withDb, type Database } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import { createMailboxReadContext } from "../lib/messages/mailbox-read-context";
import { createMailboxMail } from "../services/mailbox-mail";

function mailboxMail(env: Env, db: Database, principal: RouteContext["principal"]) {
	return createMailboxMail(createMailboxReadContext(env, db, principal));
}

export async function handleListLabels({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	try {
		const items = await withDb(env, (db) =>
			mailboxMail(env, db, principal).listLabels(params.mailboxId),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateLabel({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;
	if (typeof value.name !== "string" || !value.name.trim()) {
		return validationError(request, "Field 'name' is required");
	}

	try {
		const label = await withDb(env, (db) =>
			mailboxMail(env, db, principal).createLabel(params.mailboxId, {
				name: value.name as string,
				color: typeof value.color === "string" ? value.color : null,
			}),
		);
		return jsonResponse(label, 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleGetLabel({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	try {
		const label = await withDb(env, (db) =>
			mailboxMail(env, db, principal).getLabel(params.mailboxId, params.id),
		);
		return jsonResponse(label);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleUpdateLabel({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;

	try {
		const label = await withDb(env, (db) =>
			mailboxMail(env, db, principal).updateLabel(params.mailboxId, params.id, {
				name: typeof value.name === "string" ? value.name : undefined,
				color:
					value.color === null
						? null
						: typeof value.color === "string"
							? value.color
							: undefined,
			}),
		);
		return jsonResponse(label);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleDeleteLabel({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	try {
		await withDb(env, (db) =>
			mailboxMail(env, db, principal).removeLabel(params.mailboxId, params.id),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, request);
	}
}
