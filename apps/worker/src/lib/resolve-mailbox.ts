import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { domains, mailboxes } from "../db/schema";
import {
	isReceivingMailboxType,
	type MailboxType,
} from "./mailbox-types";
import {
	normalizeEmailAddress,
	parseEmailAddress,
} from "./normalize-email-address";

export type MatchedVia = "exact" | "alias" | "catch_all";

export type MailboxResolution = {
	envelopeTo: string;
	actualMailboxId: string;
	matchedMailboxId: string | null;
	matchedVia: MatchedVia;
};

type MailboxLookupRow = {
	id: string;
	type: MailboxType;
	aliasTargetId: string | null;
};

export function resolveConfiguredMailbox(
	mailbox: MailboxLookupRow,
	mailboxById: Map<string, MailboxLookupRow>,
): MailboxResolution | null {
	if (isReceivingMailboxType(mailbox.type)) {
		return {
			envelopeTo: "",
			actualMailboxId: mailbox.id,
			matchedMailboxId: mailbox.id,
			matchedVia: "exact",
		};
	}

	if (!mailbox.aliasTargetId) {
		return null;
	}

	const target = mailboxById.get(mailbox.aliasTargetId);
	if (!target || !isReceivingMailboxType(target.type)) {
		return null;
	}

	return {
		envelopeTo: "",
		actualMailboxId: target.id,
		matchedMailboxId: mailbox.id,
		matchedVia: "alias",
	};
}

export function resolveCatchAllMailbox(
	catchAllMailboxId: string | null,
): MailboxResolution | null {
	if (!catchAllMailboxId) {
		return null;
	}

	return {
		envelopeTo: "",
		actualMailboxId: catchAllMailboxId,
		matchedMailboxId: null,
		matchedVia: "catch_all",
	};
}

async function findMailboxById(
	db: Database,
	mailboxId: string,
): Promise<MailboxLookupRow | null> {
	const [row] = await db
		.select({
			id: mailboxes.id,
			type: mailboxes.type,
			aliasTargetId: mailboxes.aliasTargetId,
		})
		.from(mailboxes)
		.where(and(eq(mailboxes.id, mailboxId), eq(mailboxes.isActive, true)))
		.limit(1);

	return row ?? null;
}

export async function resolveMailboxForEnvelope(
	db: Database,
	envelopeTo: string,
): Promise<MailboxResolution | null> {
	const normalizedEnvelope = normalizeEmailAddress(envelopeTo);

	const [configuredMailbox] = await db
		.select({
			id: mailboxes.id,
			type: mailboxes.type,
			aliasTargetId: mailboxes.aliasTargetId,
		})
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(
			and(
				eq(mailboxes.address, normalizedEnvelope),
				eq(mailboxes.isActive, true),
				eq(domains.isActive, true),
			),
		)
		.limit(1);

	if (configuredMailbox) {
		if (isReceivingMailboxType(configuredMailbox.type)) {
			return {
				envelopeTo: normalizedEnvelope,
				actualMailboxId: configuredMailbox.id,
				matchedMailboxId: configuredMailbox.id,
				matchedVia: "exact",
			};
		}

		if (!configuredMailbox.aliasTargetId) {
			return null;
		}

		const target = await findMailboxById(db, configuredMailbox.aliasTargetId);
		if (!target || !isReceivingMailboxType(target.type)) {
			return null;
		}

		return {
			envelopeTo: normalizedEnvelope,
			actualMailboxId: target.id,
			matchedMailboxId: configuredMailbox.id,
			matchedVia: "alias",
		};
	}

	const parsed = parseEmailAddress(normalizedEnvelope);
	if (!parsed) {
		return null;
	}

	const [domain] = await db
		.select({
			catchAllEnabled: domains.catchAllEnabled,
			catchAllMailboxId: domains.catchAllMailboxId,
		})
		.from(domains)
		.where(and(eq(domains.name, parsed.domain), eq(domains.isActive, true)))
		.limit(1);

	if (!domain?.catchAllEnabled || !domain.catchAllMailboxId) {
		return null;
	}

	const catchAllTarget = await findMailboxById(db, domain.catchAllMailboxId);
	if (!catchAllTarget || !isReceivingMailboxType(catchAllTarget.type)) {
		return null;
	}

	return {
		envelopeTo: normalizedEnvelope,
		actualMailboxId: catchAllTarget.id,
		matchedMailboxId: null,
		matchedVia: "catch_all",
	};
}
