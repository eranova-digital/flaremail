import { inArray } from "drizzle-orm";

import type { Database } from "../../db/client";
import { mailboxes } from "../../db/schema";
import { isSystemManagedMailbox } from "../system-mailboxes";
import {
	accessibleMailboxIds,
	hasDomainAccess,
	isPlatformPrincipal,
} from "./principal";
import type { Principal } from "./types";

export type MailboxListScope = "mail" | "manage";

export class MailboxAccessDeniedError extends Error {
	constructor(message = "You do not have permission to access this mailbox") {
		super(message);
		this.name = "MailboxAccessDeniedError";
	}
}

async function loadSystemMailboxIds(
	db: Database,
	domainIds: string[] | null,
): Promise<Set<string>> {
	const rows = await db
		.select({
			id: mailboxes.id,
			type: mailboxes.type,
			localPart: mailboxes.localPart,
			domainId: mailboxes.domainId,
		})
		.from(mailboxes);

	const ids = new Set<string>();
	for (const row of rows) {
		if (!isSystemManagedMailbox(row)) {
			continue;
		}
		if (domainIds && !domainIds.includes(row.domainId)) {
			continue;
		}
		ids.add(row.id);
	}
	return ids;
}

async function loadSharedMailboxIds(
	db: Database,
	domainIds: string[] | null,
): Promise<Set<string>> {
	if (domainIds !== null && domainIds.length === 0) {
		return new Set();
	}

	const rows = await db
		.select({
			id: mailboxes.id,
			domainId: mailboxes.domainId,
			type: mailboxes.type,
		})
		.from(mailboxes);

	const ids = new Set<string>();
	for (const row of rows) {
		if (row.type !== "shared") {
			continue;
		}
		if (domainIds !== null && !domainIds.includes(row.domainId)) {
			continue;
		}
		ids.add(row.id);
	}
	return ids;
}

async function loadManagerAssignedSharedMailboxIds(
	db: Database,
	principal: Principal,
): Promise<Set<string>> {
	const ids = new Set<string>();
	for (const assignment of principal.sharedMailboxAssignment) {
		if (assignment.allSharedMailboxes) {
			const sharedInDomain = await loadSharedMailboxIds(db, [assignment.domainId]);
			for (const mailboxId of sharedInDomain) {
				ids.add(mailboxId);
			}
		} else if (assignment.mailboxId) {
			ids.add(assignment.mailboxId);
		}
	}
	return ids;
}

export async function collectReadableMailboxIds(
	db: Database,
	principal: Principal,
): Promise<Set<string>> {
	if (principal.kind === "legacy") {
		const rows = await db.select({ id: mailboxes.id }).from(mailboxes);
		return new Set(rows.map((row) => row.id));
	}

	if (principal.isIntendant) {
		const ids = await loadSystemMailboxIds(db, null);
		const sharedIds = await loadSharedMailboxIds(db, null);
		for (const mailboxId of sharedIds) {
			ids.add(mailboxId);
		}
		return ids;
	}

	const ids = new Set(accessibleMailboxIds(principal));

	if (principal.role === "superadmin") {
		const sharedIds = await loadSharedMailboxIds(db, null);
		for (const mailboxId of sharedIds) {
			ids.add(mailboxId);
		}
		return ids;
	}

	if (principal.role === "admin") {
		const sharedIds = await loadSharedMailboxIds(db, principal.domainIds);
		for (const mailboxId of sharedIds) {
			ids.add(mailboxId);
		}
		return ids;
	}

	if (principal.role === "manager") {
		const sharedIds = await loadManagerAssignedSharedMailboxIds(db, principal);
		for (const mailboxId of sharedIds) {
			ids.add(mailboxId);
		}
	}

	return ids;
}

export async function collectManageableMailboxIds(
	db: Database,
	principal: Principal,
): Promise<Set<string>> {
	if (principal.kind === "legacy" || isPlatformPrincipal(principal)) {
		const rows = await db.select({ id: mailboxes.id }).from(mailboxes);
		return new Set(rows.map((row) => row.id));
	}

	if (principal.role === "admin") {
		if (principal.domainIds.length === 0) {
			return new Set();
		}
		const rows = await db
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(inArray(mailboxes.domainId, principal.domainIds));
		return new Set(rows.map((row) => row.id));
	}

	if (principal.role === "manager") {
		return loadManagerAssignedSharedMailboxIds(db, principal);
	}

	return new Set();
}

export async function filterMailboxesForPrincipal<
	T extends { id: string },
>(db: Database, principal: Principal, rows: T[], scope: MailboxListScope): Promise<T[]> {
	const allowed =
		scope === "manage"
			? await collectManageableMailboxIds(db, principal)
			: await collectReadableMailboxIds(db, principal);
	return rows.filter((row) => allowed.has(row.id));
}

export async function assertPrincipalCanAccessMailbox(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	const allowed = await collectReadableMailboxIds(db, principal);
	if (!allowed.has(mailboxId)) {
		throw new MailboxAccessDeniedError();
	}
}

export async function assertPrincipalCanManageMailbox(
	db: Database,
	principal: Principal,
	mailboxId: string,
): Promise<void> {
	const allowed = await collectManageableMailboxIds(db, principal);
	if (!allowed.has(mailboxId)) {
		throw new MailboxAccessDeniedError(
			"You do not have permission to manage this mailbox",
		);
	}
}

export function assertPrincipalCanManageDomain(
	principal: Principal,
	domainId: string,
): void {
	if (principal.kind === "legacy" || isPlatformPrincipal(principal)) {
		return;
	}
	if (principal.role === "admin" && hasDomainAccess(principal, domainId)) {
		return;
	}
	throw new MailboxAccessDeniedError(
		"You do not have permission to manage this domain",
	);
}
