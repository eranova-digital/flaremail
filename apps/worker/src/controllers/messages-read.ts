import { withDb } from "../db/client";
import { parseLimit } from "../lib/http/cursor-pagination";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import { requireQueryParam } from "../lib/http/route-helpers";
import type { RouteContext } from "../lib/http/router";
import { downloadAttachment } from "../services/attachments";
import {
	readMessageFull,
	readMessagePreview,
	searchMessages,
} from "../services/threads";

export async function handleGetMessage({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	try {
		const message = await withDb(env, async (db) =>
			readMessageFull(db, env.BUCKET, params.id, mailboxId),
		);
		return jsonResponse(message);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleGetMessagePreview({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	try {
		const message = await withDb(env, (db) =>
			readMessagePreview(db, params.id, mailboxId),
		);
		return jsonResponse(message);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleSearch({
	request,
	env,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;
	if (typeof value.mailboxId !== "string" || !value.mailboxId.trim()) {
		return validationError(request, "Field 'mailboxId' is required");
	}
	if (typeof value.query !== "string") {
		return validationError(request, "Field 'query' is required");
	}

	try {
		const result = await withDb(env, (db) =>
			searchMessages(db, value.mailboxId as string, value.query as string, {
				cursor: typeof value.cursor === "string" ? value.cursor : null,
				limit:
					typeof value.limit === "number"
						? value.limit
						: parseLimit(null),
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleDownloadAttachment({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		return await withDb(env, (db) =>
			downloadAttachment(db, env.BUCKET, params.id),
		);
	} catch (error) {
		return handleRouteError(error, request);
	}
}
