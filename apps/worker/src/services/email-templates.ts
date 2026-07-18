import { asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import type { Database } from "../db/client";
import { domains, emailTemplates, mailboxes } from "../db/schema";
import { AuthorizationDeniedError } from "../lib/auth/actions";
import {
	authorizeMailbox,
	collectManageableMailboxIds,
} from "../lib/auth/authorize";
import type { Principal } from "../lib/auth/types";
import { htmlFromUploadedText } from "../lib/email-templates/html-from-upload";
import { emailTemplateStorageKey } from "../lib/email-templates/keys";

const MAX_TEMPLATE_BYTES = 1_048_576; // 1 MiB

export type EmailTemplateDto = {
	id: string;
	name: string;
	mailboxId: string | null;
	scope: "global" | "mailbox";
	mailboxAddress: string | null;
	createdAt: string;
	updatedAt: string;
};

function canManageGlobalTemplates(principal: Principal): boolean {
	if (principal.kind === "legacy" || principal.isIntendant) {
		return true;
	}
	return principal.role === "superadmin" || principal.role === "admin";
}

function assertCanManageGlobalTemplates(principal: Principal): void {
	if (!canManageGlobalTemplates(principal)) {
		throw new AuthorizationDeniedError(
			"Only admins and superadmins can manage global templates",
		);
	}
}

function toDto(
	row: {
		id: string;
		name: string;
		mailboxId: string | null;
		createdAt: Date;
		updatedAt: Date;
	},
	mailboxAddress: string | null,
): EmailTemplateDto {
	return {
		id: row.id,
		name: row.name,
		mailboxId: row.mailboxId,
		scope: row.mailboxId ? "mailbox" : "global",
		mailboxAddress,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

async function mailboxAddressById(
	db: Database,
	mailboxIds: string[],
): Promise<Map<string, string>> {
	if (mailboxIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			id: mailboxes.id,
			localPart: mailboxes.localPart,
			domainName: domains.name,
		})
		.from(mailboxes)
		.innerJoin(domains, eq(domains.id, mailboxes.domainId))
		.where(inArray(mailboxes.id, mailboxIds));

	return new Map(
		rows.map((row) => [row.id, `${row.localPart}@${row.domainName}`]),
	);
}

async function loadTemplateOrThrow(db: Database, templateId: string) {
	const [row] = await db
		.select()
		.from(emailTemplates)
		.where(eq(emailTemplates.id, templateId))
		.limit(1);

	if (!row) {
		throw new Error("Template not found");
	}

	return row;
}

async function assertCanManageTemplate(
	db: Database,
	principal: Principal,
	template: { mailboxId: string | null },
): Promise<void> {
	if (!template.mailboxId) {
		assertCanManageGlobalTemplates(principal);
		return;
	}

	await authorizeMailbox(db, principal, template.mailboxId, "manage");
}

async function assertCanReadTemplate(
	db: Database,
	principal: Principal,
	template: { mailboxId: string | null },
	forMailboxId: string | undefined,
): Promise<void> {
	if (!template.mailboxId) {
		if (forMailboxId) {
			await authorizeMailbox(db, principal, forMailboxId, "read");
			return;
		}
		// Global without a mailbox context: only managers of templates.
		if (canManageGlobalTemplates(principal)) {
			return;
		}
		throw new AuthorizationDeniedError(
			"mailboxId is required to read a global template",
		);
	}

	await authorizeMailbox(db, principal, template.mailboxId, "read");
}

export async function listTemplatesForMailbox(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<EmailTemplateDto[]> {
	await authorizeMailbox(db, principal, mailboxId, "read");

	const rows = await db
		.select()
		.from(emailTemplates)
		.where(
			or(
				isNull(emailTemplates.mailboxId),
				eq(emailTemplates.mailboxId, mailboxId),
			),
		)
		.orderBy(asc(emailTemplates.name));

	const addresses = await mailboxAddressById(
		db,
		rows
			.map((row) => row.mailboxId)
			.filter((id): id is string => typeof id === "string"),
	);

	return rows.map((row) =>
		toDto(row, row.mailboxId ? (addresses.get(row.mailboxId) ?? null) : null),
	);
}

export async function listManageableTemplates(
	db: Database,
	principal: Principal,
): Promise<EmailTemplateDto[]> {
	const manageable = await collectManageableMailboxIds(db, principal);
	const includeGlobal = canManageGlobalTemplates(principal);

	if (!includeGlobal && manageable.size === 0) {
		return [];
	}

	const conditions = [];
	if (includeGlobal) {
		conditions.push(isNull(emailTemplates.mailboxId));
	}
	if (manageable.size > 0) {
		conditions.push(inArray(emailTemplates.mailboxId, [...manageable]));
	}

	const rows = await db
		.select()
		.from(emailTemplates)
		.where(or(...conditions))
		.orderBy(
			sql`case when ${emailTemplates.mailboxId} is null then 0 else 1 end`,
			asc(emailTemplates.name),
		);

	const addresses = await mailboxAddressById(
		db,
		rows
			.map((row) => row.mailboxId)
			.filter((id): id is string => typeof id === "string"),
	);

	return rows.map((row) =>
		toDto(row, row.mailboxId ? (addresses.get(row.mailboxId) ?? null) : null),
	);
}

export async function getTemplate(
	db: Database,
	principal: Principal,
	templateId: string,
	forMailboxId?: string,
): Promise<EmailTemplateDto> {
	const row = await loadTemplateOrThrow(db, templateId);
	await assertCanReadTemplate(db, principal, row, forMailboxId);

	const addresses = row.mailboxId
		? await mailboxAddressById(db, [row.mailboxId])
		: new Map<string, string>();

	return toDto(
		row,
		row.mailboxId ? (addresses.get(row.mailboxId) ?? null) : null,
	);
}

export async function getTemplateContent(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	templateId: string,
	forMailboxId?: string,
): Promise<string> {
	const row = await loadTemplateOrThrow(db, templateId);
	await assertCanReadTemplate(db, principal, row, forMailboxId);

	const object = await bucket.get(row.storageKey);
	if (!object) {
		throw new Error("Template content not found");
	}

	return object.text();
}

export async function createTemplate(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	input: {
		name: string;
		mailboxId: string | null;
		file: File;
	},
): Promise<EmailTemplateDto> {
	const name = input.name.trim();
	if (!name) {
		throw new Error("name is required");
	}

	if (input.file.size === 0) {
		throw new Error("file is required");
	}
	if (input.file.size > MAX_TEMPLATE_BYTES) {
		throw new Error("Template file must be 1 MiB or smaller");
	}

	if (input.mailboxId) {
		await authorizeMailbox(db, principal, input.mailboxId, "manage");
	} else {
		assertCanManageGlobalTemplates(principal);
	}

	const raw = await input.file.text();
	const html = htmlFromUploadedText(raw);
	if (!html) {
		throw new Error("That HTML file is empty");
	}

	const id = crypto.randomUUID();
	const storageKey = emailTemplateStorageKey(id);
	const now = new Date();

	await bucket.put(storageKey, html, {
		httpMetadata: { contentType: "text/html; charset=utf-8" },
	});

	try {
		await db.insert(emailTemplates).values({
			id,
			name,
			mailboxId: input.mailboxId,
			storageKey,
			createdByAccountId: principal.accountId,
			createdAt: now,
			updatedAt: now,
		});
	} catch (error) {
		await bucket.delete(storageKey);
		throw error;
	}

	const addresses = input.mailboxId
		? await mailboxAddressById(db, [input.mailboxId])
		: new Map<string, string>();

	return toDto(
		{
			id,
			name,
			mailboxId: input.mailboxId,
			createdAt: now,
			updatedAt: now,
		},
		input.mailboxId ? (addresses.get(input.mailboxId) ?? null) : null,
	);
}

export async function updateTemplate(
	db: Database,
	principal: Principal,
	templateId: string,
	input: { name: string },
): Promise<EmailTemplateDto> {
	const row = await loadTemplateOrThrow(db, templateId);
	await assertCanManageTemplate(db, principal, row);

	const name = input.name.trim();
	if (!name) {
		throw new Error("name is required");
	}

	const now = new Date();
	const [updated] = await db
		.update(emailTemplates)
		.set({ name, updatedAt: now })
		.where(eq(emailTemplates.id, templateId))
		.returning();

	if (!updated) {
		throw new Error("Template not found");
	}

	const addresses = updated.mailboxId
		? await mailboxAddressById(db, [updated.mailboxId])
		: new Map<string, string>();

	return toDto(
		updated,
		updated.mailboxId ? (addresses.get(updated.mailboxId) ?? null) : null,
	);
}

export async function deleteTemplate(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	templateId: string,
): Promise<void> {
	const row = await loadTemplateOrThrow(db, templateId);
	await assertCanManageTemplate(db, principal, row);

	await db.delete(emailTemplates).where(eq(emailTemplates.id, templateId));
	await bucket.delete(row.storageKey);
}

export function principalCanManageGlobalTemplates(
	principal: Principal,
): boolean {
	return canManageGlobalTemplates(principal);
}
