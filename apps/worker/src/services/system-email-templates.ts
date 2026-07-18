import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { systemEmailTemplates } from "../db/schema";
import { AuthorizationDeniedError } from "../lib/auth/actions";
import type { Principal } from "../lib/auth/types";
import { htmlFromUploadedText } from "../lib/email-templates/html-from-upload";
import {
	SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
	applySystemTemplateTags,
	getSystemEmailTemplateDefinition,
	isSystemEmailTemplateKey,
	systemEmailTemplateStorageKey,
	type SystemEmailTemplateKey,
} from "../lib/email-templates/system-catalog";
import {
	inviteTemplateValues,
	loadSystemEmailHtml,
	mfaDisableTemplateValues,
	passwordResetTemplateValues,
	recoveryVerifyTemplateValues,
} from "../lib/email-templates/system-html";
import { getInstanceSettings } from "./instance-settings";
import { canAccessOrganizationSettings } from "./instance-settings";

const MAX_TEMPLATE_BYTES = 1_048_576; // 1 MiB

export type SystemEmailTemplateDto = {
	key: SystemEmailTemplateKey;
	label: string;
	description: string;
	subject: string;
	tags: { name: string; description: string }[];
	configured: boolean;
	updatedAt: string | null;
};

async function assertCanManageSystemTemplates(
	db: Database,
	principal: Principal,
): Promise<void> {
	if (!principal.accountId) {
		throw new AuthorizationDeniedError("Authentication required");
	}
	const settings = await getInstanceSettings(db);
	if (!canAccessOrganizationSettings(principal, settings)) {
		throw new AuthorizationDeniedError(
			"Only the intendant (and owners with organization access) can manage system templates",
		);
	}
}

function toDto(
	key: SystemEmailTemplateKey,
	updatedAt: Date | null,
): SystemEmailTemplateDto {
	const definition = getSystemEmailTemplateDefinition(key);
	return {
		key: definition.key,
		label: definition.label,
		description: definition.description,
		subject: definition.subject,
		tags: definition.tags.map((tag) => ({ ...tag })),
		configured: updatedAt !== null,
		updatedAt: updatedAt?.toISOString() ?? null,
	};
}

export async function listSystemEmailTemplates(
	db: Database,
	principal: Principal,
): Promise<SystemEmailTemplateDto[]> {
	await assertCanManageSystemTemplates(db, principal);

	const rows = await db.select().from(systemEmailTemplates);
	const updatedByKey = new Map(rows.map((row) => [row.key, row.updatedAt]));

	return SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.map((definition) =>
		toDto(definition.key, updatedByKey.get(definition.key) ?? null),
	);
}

export async function getSystemEmailTemplateContent(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	key: string,
): Promise<string> {
	await assertCanManageSystemTemplates(db, principal);
	if (!isSystemEmailTemplateKey(key)) {
		throw new Error("Unknown system email template");
	}

	const [row] = await db
		.select()
		.from(systemEmailTemplates)
		.where(eq(systemEmailTemplates.key, key))
		.limit(1);

	if (!row) {
		throw new Error("System template not configured");
	}

	const object = await bucket.get(row.storageKey);
	if (!object) {
		throw new Error("System template content not found");
	}

	return object.text();
}

export async function uploadSystemEmailTemplate(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	key: string,
	file: File,
): Promise<SystemEmailTemplateDto> {
	await assertCanManageSystemTemplates(db, principal);
	if (!isSystemEmailTemplateKey(key)) {
		throw new Error("Unknown system email template");
	}

	if (file.size === 0) {
		throw new Error("file is required");
	}
	if (file.size > MAX_TEMPLATE_BYTES) {
		throw new Error("Template file must be 1 MiB or smaller");
	}

	const raw = await file.text();
	const html = htmlFromUploadedText(raw);
	if (!html) {
		throw new Error("That HTML file is empty");
	}

	const storageKey = systemEmailTemplateStorageKey(key);
	const now = new Date();

	await bucket.put(storageKey, html, {
		httpMetadata: { contentType: "text/html; charset=utf-8" },
	});

	await db
		.insert(systemEmailTemplates)
		.values({
			key,
			storageKey,
			updatedAt: now,
			updatedByAccountId: principal.accountId,
		})
		.onConflictDoUpdate({
			target: systemEmailTemplates.key,
			set: {
				storageKey,
				updatedAt: now,
				updatedByAccountId: principal.accountId,
			},
		});

	return toDto(key, now);
}

export async function deleteSystemEmailTemplate(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	key: string,
): Promise<void> {
	await assertCanManageSystemTemplates(db, principal);
	if (!isSystemEmailTemplateKey(key)) {
		throw new Error("Unknown system email template");
	}

	const [row] = await db
		.select()
		.from(systemEmailTemplates)
		.where(eq(systemEmailTemplates.key, key))
		.limit(1);

	if (!row) {
		return;
	}

	await db
		.delete(systemEmailTemplates)
		.where(eq(systemEmailTemplates.key, key));
	await bucket.delete(row.storageKey);
}

export {
	inviteTemplateValues,
	loadSystemEmailHtml,
	mfaDisableTemplateValues,
	passwordResetTemplateValues,
	recoveryVerifyTemplateValues,
};
