import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	createLabel,
	getLabel,
	listLabels,
	removeLabel,
	updateLabel,
} from "../services/labels";

export async function handleListLabels({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		const items = await withDb(env, (db) => listLabels(db, params.mailboxId));
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateLabel({
	request,
	env,
	params,
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
			createLabel(db, params.mailboxId, {
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
}: RouteContext): Promise<Response> {
	try {
		const label = await withDb(env, (db) =>
			getLabel(db, params.mailboxId, params.id),
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
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;

	try {
		const label = await withDb(env, (db) =>
			updateLabel(db, params.mailboxId, params.id, {
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
}: RouteContext): Promise<Response> {
	try {
		await withDb(env, (db) => removeLabel(db, params.mailboxId, params.id));
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, request);
	}
}
