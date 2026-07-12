import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	getInstanceSettings,
	InstanceSettingsAccessDeniedError,
	OrganizationTabAccessDeniedError,
	parseOrganizationTabAccess,
	parseRequireMfaScope,
	updateInstanceSettings,
} from "../services/instance-settings";
import { canAccessOrganizationSettings } from "../services/security-compliance";

export async function handleGetInstanceSettings(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}

	try {
		const settings = await withDb(context.env, (db) => getInstanceSettings(db));
		if (!canAccessOrganizationSettings(context.principal, settings)) {
			return validationError(
				context.request,
				"You do not have permission to view organization settings",
			);
		}
		return jsonResponse(settings);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUpdateInstanceSettings(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}

	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;
	const organizationTabAccess = parseOrganizationTabAccess(
		value.organizationTabAccess,
	);
	const requireMfaScope = parseRequireMfaScope(value.requireMfaScope);
	const requireRecoveryEmail =
		value.requireRecoveryEmail === undefined
			? undefined
			: Boolean(value.requireRecoveryEmail);
	const persistNoreplyOutboundEmails =
		value.persistNoreplyOutboundEmails === undefined
			? undefined
			: Boolean(value.persistNoreplyOutboundEmails);

	if (
		organizationTabAccess === undefined &&
		requireMfaScope === undefined &&
		requireRecoveryEmail === undefined &&
		persistNoreplyOutboundEmails === undefined
	) {
		return validationError(context.request, "No valid settings were provided");
	}

	if (
		value.organizationTabAccess !== undefined &&
		organizationTabAccess === undefined
	) {
		return validationError(
			context.request,
			"organizationTabAccess must be intendant_only or intendant_and_superadmins",
		);
	}

	if (value.requireMfaScope !== undefined && requireMfaScope === undefined) {
		return validationError(
			context.request,
			"requireMfaScope must be none, all, manager_and_above, admin_and_above, or superadmin_and_above",
		);
	}

	try {
		const settings = await withDb(context.env, (db) =>
			updateInstanceSettings(db, context.principal, {
				organizationTabAccess,
				requireMfaScope,
				requireRecoveryEmail,
				persistNoreplyOutboundEmails,
			}),
		);
		return jsonResponse(settings);
	} catch (error) {
		if (
			error instanceof InstanceSettingsAccessDeniedError ||
			error instanceof OrganizationTabAccessDeniedError
		) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}
