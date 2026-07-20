import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import type { RouteContext } from "../lib/http/router";
import {
	getDomainReadinessSummary,
	getValidationRunDetail,
	listValidationRuns,
	startDomainValidation,
	startOrReturnValidationRun,
	cancelDomainValidationRun,
} from "../lib/domain-validation";
import { getDomainRecord } from "../services/domains";
import { parseLogContextFromRequest } from "../services/logs";

export async function handleListValidationRuns({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		const runs = await withDb(env, async (db) => {
			await getDomainRecord(db, params.id);
			return listValidationRuns(db, params.id);
		});
		return jsonResponse({ items: runs });
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleGetValidationRun({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		const run = await withDb(env, (db) =>
			getValidationRunDetail(db, params.id, params.runId),
		);
		return jsonResponse(run);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCreateValidationRun({
	request,
	env,
	params,
	principal,
}: RouteContext): Promise<Response> {
	try {
		const run = await withDb(env, async (db) => {
			const domain = await getDomainRecord(db, params.id);
			return startOrReturnValidationRun(
				db,
				env.EMAIL,
				domain.id,
				domain.name,
				{
					actorAccountId: principal.accountId,
					context: parseLogContextFromRequest(request),
				},
			);
		});
		return jsonResponse(run, 200);
	} catch (error) {
		return handleRouteError(error, request);
	}
}

export async function handleCancelValidationRun({
	request,
	env,
	params,
}: RouteContext): Promise<Response> {
	try {
		const run = await withDb(env, async (db) => {
			await getDomainRecord(db, params.id);
			return cancelDomainValidationRun(db, params.id, params.runId);
		});
		return jsonResponse(run, 200);
	} catch (error) {
		return handleRouteError(error, request);
	}
}
