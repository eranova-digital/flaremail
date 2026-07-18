import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "../../db/client";
import { identities, mailboxes } from "../../db/schema";
import { authorizeMailbox } from "../../lib/auth/access";
import type { Principal } from "../../lib/auth/types";
import { resolveFromName, type IdentityNamePattern } from "@test-worker/identity-name-pattern";
import { getInstanceSettings } from "../instance-settings";
import {
	type IdentityDto,
	IdentityValidationError,
	loadProfileForAccount,
	toDefaultIdentityDto,
	toIdentityDto,
	toSystemMailboxFallbackIdentityDto,
	getMailboxRow,
} from "./shared";

/**
 * Identities selectable when composing from `activeMailboxId`.
 */
export async function listAvailableIdentitiesForSend(
	db: Database,
	principal: Principal,
	activeMailboxId: string,
): Promise<IdentityDto[]> {
	await authorizeMailbox(db, principal, activeMailboxId, "read");
	const active = await getMailboxRow(db, activeMailboxId);
	const profile = await loadProfileForAccount(db, principal.accountId);
	const result: IdentityDto[] = [];
	const seen = new Set<string>();

	const pushAll = (items: IdentityDto[]) => {
		for (const item of items) {
			if (seen.has(item.id)) {
				continue;
			}
			seen.add(item.id);
			result.push(item);
		}
	};

	const loadOwned = async (mailboxId: string) => {
		const rows = await db
			.select()
			.from(identities)
			.where(eq(identities.mailboxId, mailboxId))
			.orderBy(asc(identities.createdAt));
		return rows.map((row) =>
			toIdentityDto(
				{
					...row,
					namePattern: row.namePattern as IdentityNamePattern,
				},
				profile,
			),
		);
	};

	if (active.type === "primary") {
		const settings = await getInstanceSettings(db);
		pushAll([toDefaultIdentityDto(settings, profile)]);
	}

	pushAll(await loadOwned(activeMailboxId));

	if (
		active.type === "shared" &&
		active.personalIdentityAllowance &&
		principal.primaryMailboxId
	) {
		pushAll(await loadOwned(principal.primaryMailboxId));
	}

	if (principal.accountId) {
		const exportRows = await db
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(
				and(
					eq(mailboxes.identityExport, true),
					eq(mailboxes.type, "shared"),
				),
			);

		const exportIds = exportRows
			.map((row) => row.id)
			.filter((id) => id !== activeMailboxId);

		if (exportIds.length > 0) {
			const readable = await Promise.all(
				exportIds.map(async (id) => {
					try {
						await authorizeMailbox(db, principal, id, "read");
						return id;
					} catch {
						return null;
					}
				}),
			);
			const allowedExportIds = readable.filter((id): id is string => id !== null);
			if (allowedExportIds.length > 0) {
				const rows = await db
					.select()
					.from(identities)
					.where(inArray(identities.mailboxId, allowedExportIds))
					.orderBy(asc(identities.createdAt));
				pushAll(
					rows.map((row) =>
						toIdentityDto(
							{
								...row,
								namePattern: row.namePattern as IdentityNamePattern,
							},
							profile,
						),
					),
				);
			}
		}
	}

	// System/blackhole mailboxes are not provisioned with identities, but still
	// send (e.g. noreply transactional mail). Offer a nameless fallback.
	if (
		result.length === 0 &&
		(active.type === "system" || active.type === "blackhole")
	) {
		pushAll([toSystemMailboxFallbackIdentityDto(activeMailboxId)]);
	}

	return result;
}

export async function resolveIdentityForSend(
	db: Database,
	principal: Principal,
	activeMailboxId: string,
	identityId: string | null | undefined,
): Promise<{
	identity: IdentityDto;
	fromName: string;
	signatureHtml: string | null;
}> {
	const available = await listAvailableIdentitiesForSend(
		db,
		principal,
		activeMailboxId,
	);
	let identity =
		identityId && identityId.length > 0
			? available.find((item) => item.id === identityId)
			: undefined;

	if (!identity) {
		identity = available[0];
	}
	if (!identity) {
		throw new IdentityValidationError("No identity available for this mailbox");
	}

	const profile = await loadProfileForAccount(db, principal.accountId);
	const fromName = resolveFromName(
		identity.namePattern,
		profile,
		identity.customName,
	);

	return {
		identity,
		fromName,
		signatureHtml: identity.signatureHtml,
	};
}
