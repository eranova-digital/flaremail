import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { domains, mailboxes } from "../db/schema";
import { isReceivingMailboxType } from "../lib/mailbox-types";
import type { MailboxType } from "../lib/mailbox-types";
import {
	buildEmailAddress,
	normalizeEmailAddress,
	parseEmailAddress,
} from "../lib/normalize-email-address";
import {
	assertMailboxMutable,
	assertMailboxNotPrimaryAccount,
	isSystemManagedLocalPart,
} from "../lib/system-mailboxes";
import { isSystemManagedMailbox } from "../lib/system-mailboxes";
import { deleteMailboxCascade } from "./cascade-delete";
import type { LogContext } from "../lib/logs/context";
import { safeEmitLog } from "../lib/logs/emit";

export function toMailboxDto(mailbox: {
	id: string;
	domainId: string;
	address: string;
	localPart: string;
	type: string;
	aliasTargetId: string | null;
	aliasTargetAddress: string | null;
	isActive: boolean;
	personalIdentityAllowance?: boolean;
	identityExport?: boolean;
}) {
	return {
		id: mailbox.id,
		domainId: mailbox.domainId,
		address: mailbox.address,
		localPart: mailbox.localPart,
		type: mailbox.type,
		aliasTargetId: mailbox.aliasTargetId,
		aliasTargetAddress: mailbox.aliasTargetAddress,
		isActive: mailbox.isActive,
		personalIdentityAllowance: mailbox.personalIdentityAllowance ?? false,
		identityExport: mailbox.identityExport ?? false,
		isSystemManaged: isSystemManagedMailbox(mailbox),
	};
}

async function getMailboxRow(db: Database, id: string) {
	const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, id)).limit(1);
	if (!row) {
		throw new Error("Mailbox not found");
	}

	return row;
}

export async function listMailboxes(db: Database) {
	const rows = await db.select().from(mailboxes).orderBy(mailboxes.address);
	return rows.map(toMailboxDto);
}

export async function getMailbox(db: Database, id: string) {
	const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, id)).limit(1);
	if (!row) {
		throw new Error("Mailbox not found");
	}

	return toMailboxDto(row);
}

export async function createMailbox(
	db: Database,
	input: {
		address: string;
		domainId: string;
		type: MailboxType;
		aliasTargetId?: string;
		aliasTargetAddress?: string;
	},
	logMeta?: { actorAccountId?: string | null; context?: LogContext | null },
) {
	const parsed = parseEmailAddress(input.address);
	if (!parsed) {
		throw new Error("Invalid mailbox address");
	}

	const [domain] = await db
		.select()
		.from(domains)
		.where(eq(domains.id, input.domainId))
		.limit(1);

	if (!domain) {
		throw new Error("Domain not found");
	}

	if (normalizeEmailAddress(parsed.domain) !== normalizeEmailAddress(domain.name)) {
		throw new Error("Address domain does not match domainId");
	}

	if (input.type === "system" || input.type === "blackhole") {
		throw new Error("System mailboxes are provisioned automatically");
	}

	if (isSystemManagedLocalPart(parsed.localPart)) {
		throw new Error("Address is reserved for system mailboxes");
	}

	const aliasTargetId = input.aliasTargetId?.trim() || undefined;
	const aliasTargetAddressInput = input.aliasTargetAddress?.trim() || undefined;

	if (input.type === "alias") {
		if (!aliasTargetId && !aliasTargetAddressInput) {
			throw new Error(
				"aliasTargetId or aliasTargetAddress is required for alias mailboxes",
			);
		}

		if (aliasTargetId && aliasTargetAddressInput) {
			throw new Error(
				"Provide either aliasTargetId or aliasTargetAddress, not both",
			);
		}

		if (aliasTargetId) {
			const [target] = await db
				.select({ id: mailboxes.id, type: mailboxes.type })
				.from(mailboxes)
				.where(eq(mailboxes.id, aliasTargetId))
				.limit(1);

			if (!target || !isReceivingMailboxType(target.type)) {
				throw new Error("aliasTargetId must reference a receiving mailbox");
			}
		} else if (aliasTargetAddressInput) {
			const parsedTarget = parseEmailAddress(aliasTargetAddressInput);
			if (!parsedTarget) {
				throw new Error("Invalid aliasTargetAddress");
			}
		}
	} else if (aliasTargetId || aliasTargetAddressInput) {
		throw new Error(
			"aliasTargetId and aliasTargetAddress are only valid for alias mailboxes",
		);
	}

	const normalizedAliasTargetAddress = aliasTargetAddressInput
		? normalizeEmailAddress(aliasTargetAddressInput)
		: null;

	const id = crypto.randomUUID();
	const now = new Date();
	const address = buildEmailAddress(parsed.localPart, domain.name);

	try {
		const [row] = await db
			.insert(mailboxes)
			.values({
				id,
				domainId: input.domainId,
				localPart: parsed.localPart,
				address,
				type: input.type,
				aliasTargetId: aliasTargetId ?? null,
				aliasTargetAddress: normalizedAliasTargetAddress,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		const created = toMailboxDto(row);
		if (created.type === "shared" && logMeta?.actorAccountId) {
			await safeEmitLog(db, {
				importance: 4,
				type: "mailboxes",
				summary: "{actor} created {mailbox}",
				refs: {
					actor: { kind: "account", id: logMeta.actorAccountId },
					mailbox: { kind: "mailbox", id: created.id },
				},
				actorAccountId: logMeta.actorAccountId,
				context: logMeta.context ?? null,
			});
		}

		return created;
	} catch {
		throw new Error("Mailbox already exists");
	}
}

export async function updateMailbox(
	db: Database,
	id: string,
	patch: {
		isActive?: boolean;
		personalIdentityAllowance?: boolean;
		identityExport?: boolean;
	},
) {
	const existing = await getMailboxRow(db, id);

	if (patch.isActive !== undefined) {
		assertMailboxMutable(existing);
	}

	if (
		patch.personalIdentityAllowance !== undefined ||
		patch.identityExport !== undefined
	) {
		if (existing.type !== "shared") {
			throw new Error(
				"Identity policy settings are only valid for shared mailboxes",
			);
		}
	}

	const now = new Date();

	const [row] = await db
		.update(mailboxes)
		.set({
			...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
			...(patch.personalIdentityAllowance !== undefined
				? { personalIdentityAllowance: patch.personalIdentityAllowance }
				: {}),
			...(patch.identityExport !== undefined
				? { identityExport: patch.identityExport }
				: {}),
			updatedAt: now,
		})
		.where(eq(mailboxes.id, id))
		.returning();

	if (!row) {
		throw new Error("Mailbox not found");
	}

	return toMailboxDto(row);
}

export async function removeMailbox(
	db: Database,
	bucket: R2Bucket,
	id: string,
	logMeta?: { actorAccountId?: string | null; context?: LogContext | null },
): Promise<void> {
	const existing = await getMailboxRow(db, id);
	assertMailboxMutable(existing);
	await assertMailboxNotPrimaryAccount(db, id);
	const mailbox = toMailboxDto(existing);
	await deleteMailboxCascade(db, bucket, id);

	if (mailbox.type === "shared" && logMeta?.actorAccountId) {
		await safeEmitLog(db, {
			importance: 4,
			type: "mailboxes",
			summary: "{actor} deleted {mailbox}",
			refs: {
				actor: { kind: "account", id: logMeta.actorAccountId },
				mailbox: { kind: "mailbox", id: mailbox.id },
			},
			actorAccountId: logMeta.actorAccountId,
			context: logMeta.context ?? null,
		});
	}
}
