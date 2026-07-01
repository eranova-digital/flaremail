import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	createDomain,
	getDomain,
	listDomains,
	removeDomain,
	updateDomain,
} from "../services/domains";

export async function handleListDomains({
	request,
	env,
}: RouteContext): Promise<Response> {
	try {
		const domains = await withDb(env, (db) => listDomains(db));
		return jsonResponse({ items: domains });
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateDomain({
	request,
	env,
}: RouteContext): Promise<Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;
	if (typeof value.domain !== "string" || !value.domain.trim()) {
		return validationError(request, "Field 'domain' is required");
	}

	try {
		const domain = await withDb(env, (db) =>
			createDomain(db, value.domain as string),
		);
		return jsonResponse(domain, 201);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleGetDomain({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		const domain = await withDb(env, (db) => getDomain(db, params.id));
		return jsonResponse(domain);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleUpdateDomain({
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
		const domain = await withDb(env, (db) =>
			updateDomain(db, params.id, {
				isActive:
					typeof value.isActive === "boolean" ? value.isActive : undefined,
				catchAllEnabled:
					typeof value.catchAllEnabled === "boolean"
						? value.catchAllEnabled
						: undefined,
				catchAllMailboxId:
					value.catchAllMailboxId === null
						? null
						: typeof value.catchAllMailboxId === "string"
							? value.catchAllMailboxId
							: undefined,
			}),
		);
		return jsonResponse(domain);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleDeleteDomain({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		await withDb(env, (db) => removeDomain(db, env.BUCKET, params.id));
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, request);
	}
}
