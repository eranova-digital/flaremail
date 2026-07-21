import { withDb, type Database } from "../db/client";
import { parseLimit } from "../lib/http/cursor-pagination";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { problemResponse, requestInstance, validationError } from "../lib/http/problem";
import { requireQueryParam } from "../lib/http/route-helpers";
import type { RouteContext } from "../lib/http/router";
import { createMailboxReadContext } from "../lib/messages/mailbox-read-context";
import {
	isThreadAction,
	isThreadFolder,
	type ThreadAction,
} from "../lib/mailbox-types";
import { createMailboxMail } from "../services/mailbox-mail";

function mailboxMail(
	env: Env,
	db: Database,
	principal: RouteContext["principal"],
	request: Request,
) {
	return createMailboxMail(
		createMailboxReadContext(env, db, principal, request),
	);
}

export async function handleListThreads({
	request,
	env,
	principal,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	const url = new URL(request.url);
	const folderParam = url.searchParams.get("folder");
	const folder =
		folderParam && isThreadFolder(folderParam) ? folderParam : null;

	if (folderParam && !folder) {
		return validationError(request, "Invalid folder query parameter");
	}

	const labelId = url.searchParams.get("labelId");

	try {
		const result = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).listThreads(mailboxId, {
				folder,
				labelId,
				cursor: url.searchParams.get("cursor"),
				limit: parseLimit(url.searchParams.get("limit")),
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleGetThread({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	try {
		const thread = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).getThread(params.id, mailboxId),
		);
		return jsonResponse(thread);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleListThreadMessages({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	try {
		const url = new URL(request.url);
		const includeBody = url.searchParams.get("includeBody") === "true";
		const result = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).listThreadMessages(params.id, mailboxId, {
				includeBody,
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleThreadAction({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	if (!isThreadAction(params.action)) {
		return problemResponse(404, `Unknown thread action: ${params.action}`, {
			code: "not-found",
			instance: requestInstance(request),
		});
	}

	try {
		const thread = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).runThreadAction(
				params.id,
				mailboxId,
				params.action as ThreadAction,
			),
		);
		return jsonResponse(thread);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handlePatchThread({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;
	if (!Array.isArray(value.labelIds)) {
		return validationError(request, "Field 'labelIds' must be an array");
	}

	try {
		const thread = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).replaceThreadLabels(
				params.id,
				mailboxId,
				value.labelIds as string[],
			),
		);
		return jsonResponse(thread);
	} catch (error) {
		return handleRouteError(error, request);
	}
}
