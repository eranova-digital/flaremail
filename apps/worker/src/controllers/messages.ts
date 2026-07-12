import { withDb, type Database } from "../db/client";
import { assertPrincipalCanAccessMailbox } from "../lib/auth/mailbox-access";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { outboundContext } from "../lib/http/route-helpers";
import type { RouteContext } from "../lib/http/router";
import {
	parseCreateDraftBody,
	parseForwardBody,
	parseOutboundMessageBody,
	parseReplyBody,
	parseSendMessageBody,
} from "../lib/messages/outbound-payload";
import { createOutboundMail } from "../services/outbound-mail";
import { toSendResponse } from "../services/dto";

function outboundMail(env: Env, db: Database) {
	return createOutboundMail({ ...outboundContext(env), db });
}

export async function handleSendMessage({
	request,
	env,
	principal,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	try {
		const payload = parseSendMessageBody(body);
		const message = await withDb(env, async (db) => {
			await assertPrincipalCanAccessMailbox(db, principal, payload.mailboxId);
			return outboundMail(env, db).send(payload.mailboxId, payload);
		});
		return jsonResponse(toSendResponse(message), 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateDraft({
	request,
	env,
	principal,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	try {
		const payload = parseCreateDraftBody(body);
		const message = await withDb(env, async (db) => {
			await assertPrincipalCanAccessMailbox(db, principal, payload.mailboxId);
			return outboundMail(env, db).createDraft(payload);
		});
		return jsonResponse(toSendResponse(message), 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleUpdateDraft({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	try {
		const payload = parseOutboundMessageBody(body);
		const message = await withDb(env, async (db) =>
			outboundMail(env, db).updateDraft(params.id, payload),
		);
		return jsonResponse(toSendResponse({ ...message, sendStatus: message.sendStatus ?? "draft" }));
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleDeleteDraft({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		await withDb(env, async (db) =>
			outboundMail(env, db).deleteDraft(params.id),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleSendDraft({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		const message = await withDb(env, async (db) =>
			outboundMail(env, db).sendDraft(params.id),
		);
		return jsonResponse(toSendResponse(message));
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleReplyToMessage({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	try {
		const payload = parseReplyBody(body);
		const message = await withDb(env, async (db) =>
			outboundMail(env, db).reply(params.id, payload),
		);
		return jsonResponse(toSendResponse(message), 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleForwardToMessage({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	try {
		const payload = parseForwardBody(body);
		const message = await withDb(env, async (db) =>
			outboundMail(env, db).forward(params.id, payload),
		);
		return jsonResponse(toSendResponse(message), 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}
