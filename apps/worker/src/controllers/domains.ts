import { withDb } from "../db/client";
import { hasDomainAccess, isPlatformPrincipal } from "../lib/auth/principal";
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
import {
	parseLogContextFromRequest,
	safeEmitLog,
} from "../services/logs";

export async function handleListDomains({
	request,
	env,
	principal,
}: RouteContext): Promise<Response> {
	try {
		const domains = await withDb(env, async (db) => {
			const all = await listDomains(db);
			if (principal.kind === "legacy" || isPlatformPrincipal(principal)) {
				return all;
			}
			if (principal.domainIds.length === 0) {
				return [];
			}
			return all.filter((domain) =>
				domain.id ? hasDomainAccess(principal, domain.id) : false,
			);
		});
		return jsonResponse({ items: domains });
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateDomain({
	request,
	env,
	principal,
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
		const logContext = parseLogContextFromRequest(request);
		const domain = await withDb(env, async (db) => {
			const created = await createDomain(db, value.domain as string, env.EMAIL, {
				actorAccountId: principal.accountId,
				context: logContext,
			});
			if (principal.accountId) {
				await safeEmitLog(db, {
					importance: 3,
					type: "domains",
					summary: "{actor} registered {domain}",
					refs: {
						actor: { kind: "account", id: principal.accountId },
						domain: { kind: "domain", id: created.id },
					},
					actorAccountId: principal.accountId,
					context: logContext,
				});
			} else {
				await safeEmitLog(db, {
					importance: 3,
					type: "domains",
					summary: "Registered {domain}",
					refs: {
						domain: { kind: "domain", id: created.id },
					},
					actorAccountId: null,
					context: logContext,
				});
			}
			return created;
		});
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
	principal,
}: RouteContext): Promise<Response> {
	try {
		await withDb(env, async (db) => {
			await removeDomain(db, env.BUCKET, params.id);
			if (principal.accountId) {
				await safeEmitLog(db, {
					importance: 3,
					type: "domains",
					summary: "{actor} deleted {domain}",
					refs: {
						actor: { kind: "account", id: principal.accountId },
						domain: { kind: "domain", id: params.id },
					},
					actorAccountId: principal.accountId,
					context: parseLogContextFromRequest(request),
				});
			} else {
				await safeEmitLog(db, {
					importance: 3,
					type: "domains",
					summary: "Deleted {domain}",
					refs: {
						domain: { kind: "domain", id: params.id },
					},
					actorAccountId: null,
					context: parseLogContextFromRequest(request),
				});
			}
		});
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, request);
	}
}
