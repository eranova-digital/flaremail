import { withDb } from "../db/client";
import { parseLimit } from "../lib/http/cursor-pagination";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { problemResponse, requestInstance, validationError } from "../lib/http/problem";
import { requireQueryParam } from "../lib/http/route-helpers";
import type { RouteContext } from "../lib/http/router";
import type { ThreadFolder } from "../lib/touch-thread";
import { downloadAttachment } from "../services/attachments";
import {
	createLabel,
	getLabel,
	listLabels,
	removeLabel,
	updateLabel,
} from "../services/labels";
import {
	getThread,
	listThreadMessages,
	listThreads,
	readMessageFull,
	readMessagePreview,
	replaceThreadLabels,
	searchMessages,
} from "../services/threads";
import {
	runThreadAction,
	type ThreadAction,
} from "../services/thread-commands";

const THREAD_FOLDERS = new Set([
	"inbox",
	"spam",
	"trash",
	"archived",
	"drafts",
	"sent",
]);

const THREAD_ACTIONS = new Set<ThreadAction>([
	"archive",
	"trash",
	"spam",
	"restore",
	"mark-read",
	"mark-unread",
	"star",
	"unstar",
]);

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

export async function handleListThreads({
	request,
	env,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	const url = new URL(request.url);
	const folderParam = url.searchParams.get("folder");
	const folder =
		folderParam && THREAD_FOLDERS.has(folderParam)
			? (folderParam as ThreadFolder)
			: null;

	if (folderParam && !folder) {
		return validationError(request, "Invalid folder query parameter");
	}

	try {
		const result = await withDb(env, (db) =>
			listThreads(db, mailboxId, {
				folder,
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
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	try {
		const thread = await withDb(env, (db) =>
			getThread(db, params.id, mailboxId),
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
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	try {
		const result = await withDb(env, (db) =>
			listThreadMessages(db, params.id, mailboxId),
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
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	if (!THREAD_ACTIONS.has(params.action as ThreadAction)) {
		return problemResponse(404, `Unknown thread action: ${params.action}`, {
			code: "not-found",
			instance: requestInstance(request),
		});
	}

	try {
		const thread = await withDb(env, async (db) => {
			await getThread(db, params.id, mailboxId);
			await runThreadAction(
				db,
				params.id,
				mailboxId,
				params.action as ThreadAction,
			);
			return getThread(db, params.id, mailboxId);
		});
		return jsonResponse(thread);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handlePatchThread({
	request,
	env,
	params,
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
			replaceThreadLabels(
				db,
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
