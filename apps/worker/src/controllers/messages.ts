import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { outboundContext } from "../lib/http/route-helpers";
import type { RouteContext } from "../lib/http/router";
import {
	parseCreateDraftBody,
	parseOutboundMessageBody,
	parseReplyBody,
	parseSendMessageBody,
} from "../lib/messages/outbound-payload";
import {
	createDraft,
	deleteDraft,
	directSend,
	replyToMessage,
	sendDraftMessage,
	updateDraft,
} from "../lib/messages/send-outbound-email";
import { toSendResponse } from "../services/dto";

export async function handleSendMessage({
	request,
	env,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	try {
		const payload = parseSendMessageBody(body);
		const message = await withDb(env, async (db) =>
			directSend({ ...outboundContext(env), db }, payload.mailboxId, payload),
		);
		return jsonResponse(toSendResponse(message), 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateDraft({
	request,
	env,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	try {
		const payload = parseCreateDraftBody(body);
		const message = await withDb(env, async (db) =>
			createDraft({ ...outboundContext(env), db }, payload),
		);
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
			updateDraft({ ...outboundContext(env), db }, params.id, payload),
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
			deleteDraft({ ...outboundContext(env), db }, params.id),
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
			sendDraftMessage({ ...outboundContext(env), db }, params.id),
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
			replyToMessage({ ...outboundContext(env), db }, params.id, payload),
		);
		return jsonResponse(toSendResponse(message), 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}
