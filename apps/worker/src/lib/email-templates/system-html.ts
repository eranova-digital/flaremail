import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { systemEmailTemplates } from "../../db/schema";
import {
	applySystemTemplateTags,
	getSystemEmailTemplateDefinition,
	type SystemEmailTemplateKey,
} from "./system-catalog";

export async function loadSystemEmailHtml(
	db: Database,
	bucket: R2Bucket,
	key: SystemEmailTemplateKey,
	values: Record<string, string>,
): Promise<string | undefined> {
	const [row] = await db
		.select()
		.from(systemEmailTemplates)
		.where(eq(systemEmailTemplates.key, key))
		.limit(1);

	if (!row) {
		return undefined;
	}

	const object = await bucket.get(row.storageKey);
	if (!object) {
		return undefined;
	}

	return applySystemTemplateTags(await object.text(), values);
}

export function inviteTemplateValues(code: string): Record<string, string> {
	const definition = getSystemEmailTemplateDefinition("invite");
	return {
		invite_code: code,
		code,
		expires_in: definition.expiresIn,
	};
}

export function passwordResetTemplateValues(
	code: string,
): Record<string, string> {
	const definition = getSystemEmailTemplateDefinition("password_reset");
	return {
		reset_code: code,
		code,
		expires_in: definition.expiresIn,
	};
}

export function recoveryVerifyTemplateValues(
	code: string,
): Record<string, string> {
	const definition = getSystemEmailTemplateDefinition("recovery_verify");
	return {
		verification_code: code,
		code,
		expires_in: definition.expiresIn,
	};
}

export function mfaDisableTemplateValues(code: string): Record<string, string> {
	const definition = getSystemEmailTemplateDefinition("mfa_disable");
	return {
		verification_code: code,
		code,
		expires_in: definition.expiresIn,
	};
}
