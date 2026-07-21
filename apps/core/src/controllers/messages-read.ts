import { withDb, type Database } from "../db/client";
import { parseLimit } from "../lib/http/cursor-pagination";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import { requireQueryParam } from "../lib/http/route-helpers";
import type { RouteContext } from "../lib/http/router";
import { createMailboxReadContext } from "../lib/messages/mailbox-read-context";
import { createMailboxMail } from "../services/mailbox-mail";
import { downloadAttachment } from "../services/attachments";
import { downloadMessageExternalImage } from "../services/email-images";

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

export async function handleGetMessage({
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
		const message = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).getMessage(params.id, mailboxId),
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
	principal,
}: RouteContext): Promise<Response> {
	const mailboxId = requireQueryParam(request, "mailboxId");
	if (mailboxId instanceof Response) {
		return mailboxId;
	}

	try {
		const message = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).getMessagePreview(params.id, mailboxId),
		);
		return jsonResponse(message);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleSearch({
	request,
	env,
	principal,
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
		const mailboxId = value.mailboxId as string;
		const result = await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).search(mailboxId, value.query as string, {
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

export async function handleDownloadRawMessage({
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
		return await withDb(env, (db) =>
			mailboxMail(env, db, principal, request).downloadRawMessage(params.id, mailboxId),
		);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleDownloadAttachment({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	try {
		return await withDb(env, (db) =>
			downloadAttachment(db, env.BUCKET, principal, params.id),
		);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleDownloadMessageExternalImage({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	try {
		return await withDb(env, (db) =>
			downloadMessageExternalImage(
				db,
				env.BUCKET,
				principal,
				params.id,
				params.imageId,
			),
		);
	} catch (error) {
		return handleRouteError(error, request);
	}
}
