import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import { parseIdentityNamePattern } from "../services/identities";
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
	const identitySelfServe =
		value.identitySelfServe === undefined
			? undefined
			: Boolean(value.identitySelfServe);
	const customNameAllowance =
		value.customNameAllowance === undefined
			? undefined
			: Boolean(value.customNameAllowance);
	const defaultIdentityNamePattern = parseIdentityNamePattern(
		value.defaultIdentityNamePattern,
	);
	const defaultIdentityCustomName =
		value.defaultIdentityCustomName === undefined
			? undefined
			: value.defaultIdentityCustomName === null
				? null
				: String(value.defaultIdentityCustomName);
	const defaultIdentitySignatureHtml =
		value.defaultIdentitySignatureHtml === undefined
			? undefined
			: value.defaultIdentitySignatureHtml === null
				? null
				: String(value.defaultIdentitySignatureHtml);

	if (
		organizationTabAccess === undefined &&
		requireMfaScope === undefined &&
		requireRecoveryEmail === undefined &&
		persistNoreplyOutboundEmails === undefined &&
		identitySelfServe === undefined &&
		customNameAllowance === undefined &&
		defaultIdentityNamePattern === undefined &&
		defaultIdentityCustomName === undefined &&
		defaultIdentitySignatureHtml === undefined
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

	if (
		value.defaultIdentityNamePattern !== undefined &&
		defaultIdentityNamePattern === undefined
	) {
		return validationError(
			context.request,
			"defaultIdentityNamePattern is invalid",
		);
	}

	try {
		const settings = await withDb(context.env, async (db) => {
			const current = await getInstanceSettings(db);
			const nextPattern =
				defaultIdentityNamePattern ?? current.defaultIdentityNamePattern;
			const nextCustom =
				defaultIdentityCustomName !== undefined
					? defaultIdentityCustomName?.trim() || null
					: current.defaultIdentityCustomName;

			if (nextPattern === "custom" && !nextCustom) {
				throw new Error("defaultIdentityCustomName is required for custom pattern");
			}

			return updateInstanceSettings(db, context.principal, {
				organizationTabAccess,
				requireMfaScope,
				requireRecoveryEmail,
				persistNoreplyOutboundEmails,
				identitySelfServe,
				customNameAllowance,
				defaultIdentityNamePattern,
				defaultIdentityCustomName:
					nextPattern === "custom"
						? nextCustom
						: defaultIdentityNamePattern !== undefined
							? null
							: defaultIdentityCustomName,
				defaultIdentitySignatureHtml,
			});
		});
		return jsonResponse(settings);
	} catch (error) {
		if (
			error instanceof InstanceSettingsAccessDeniedError ||
			error instanceof OrganizationTabAccessDeniedError
		) {
			return validationError(context.request, error.message);
		}
		if (
			error instanceof Error &&
			error.message.includes("defaultIdentityCustomName")
		) {
			return validationError(context.request, error.message);
		}
		return handleRouteError(error, context.request);
	}
}
