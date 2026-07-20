import { withDb } from "../db/client";
import { isPlatformPrincipal } from "../lib/auth/principal";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import { isLogType, listLogs, type LogType } from "../services/logs";

export async function handleListLogs(context: RouteContext) {
	if (!context.principal.accountId || !isPlatformPrincipal(context.principal)) {
		return validationError(
			context.request,
			"Only the intendant and superadmins can view logs",
		);
	}

	const url = new URL(context.request.url);
	const q = url.searchParams.get("q")?.trim() || undefined;
	const typesParam = url.searchParams.getAll("type");
	const types: LogType[] = [];
	for (const value of typesParam) {
		for (const part of value.split(",")) {
			const trimmed = part.trim();
			if (!trimmed) continue;
			if (!isLogType(trimmed)) {
				return validationError(
					context.request,
					`Invalid log type: ${trimmed}`,
				);
			}
			types.push(trimmed);
		}
	}

	const maxImportanceRaw = url.searchParams.get("maxImportance");
	const minImportanceRaw = url.searchParams.get("minImportance");
	const maxImportance =
		maxImportanceRaw === null ? undefined : Number(maxImportanceRaw);
	const minImportance =
		minImportanceRaw === null ? undefined : Number(minImportanceRaw);

	if (
		maxImportance !== undefined &&
		(!Number.isInteger(maxImportance) ||
			maxImportance < 0 ||
			maxImportance > 10)
	) {
		return validationError(
			context.request,
			"maxImportance must be an integer from 0 to 10",
		);
	}
	if (
		minImportance !== undefined &&
		(!Number.isInteger(minImportance) ||
			minImportance < 0 ||
			minImportance > 10)
	) {
		return validationError(
			context.request,
			"minImportance must be an integer from 0 to 10",
		);
	}

	const fromRaw = url.searchParams.get("from");
	const toRaw = url.searchParams.get("to");
	const from = fromRaw ? new Date(fromRaw) : undefined;
	const to = toRaw ? new Date(toRaw) : undefined;
	if (from && Number.isNaN(from.getTime())) {
		return validationError(context.request, "from must be a valid ISO datetime");
	}
	if (to && Number.isNaN(to.getTime())) {
		return validationError(context.request, "to must be a valid ISO datetime");
	}

	const limitRaw = url.searchParams.get("limit");
	const limit = limitRaw === null ? undefined : Number(limitRaw);
	if (
		limit !== undefined &&
		(!Number.isInteger(limit) || limit < 1 || limit > 100)
	) {
		return validationError(
			context.request,
			"limit must be an integer from 1 to 100",
		);
	}

	const before = url.searchParams.get("before") ?? undefined;

	const accountIdRaw = url.searchParams.get("accountId")?.trim() || undefined;
	const accountId =
		accountIdRaw &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			accountIdRaw,
		)
			? accountIdRaw
			: undefined;
	if (accountIdRaw && !accountId) {
		return validationError(context.request, "accountId must be a valid UUID");
	}

	try {
		const result = await withDb(context.env, (db) =>
			listLogs(db, {
				q,
				types: types.length > 0 ? types : undefined,
				maxImportance,
				minImportance,
				from,
				to,
				limit,
				before,
				accountId,
			}),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
