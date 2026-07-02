import type { Database } from "../db/client";
import { mailboxes } from "../db/schema";
import { buildEmailAddress } from "./normalize-email-address";

export const SYSTEM_POSTMASTER_LOCAL_PART = "postmaster";
export const SYSTEM_ALIAS_LOCAL_PARTS = ["abuse", "noreply"] as const;

const SYSTEM_MANAGED_LOCAL_PARTS = [
	SYSTEM_POSTMASTER_LOCAL_PART,
	...SYSTEM_ALIAS_LOCAL_PARTS,
] as const;

export function isSystemManagedLocalPart(localPart: string): boolean {
	const normalized = localPart.trim().toLowerCase();
	return (SYSTEM_MANAGED_LOCAL_PARTS as readonly string[]).includes(normalized);
}

export function isSystemManagedMailbox(mailbox: {
	type: string;
	localPart: string;
}): boolean {
	return mailbox.type === "system" || isSystemManagedLocalPart(mailbox.localPart);
}

export function assertMailboxMutable(mailbox: {
	type: string;
	localPart: string;
}): void {
	if (isSystemManagedMailbox(mailbox)) {
		throw new Error("System mailboxes cannot be modified or deleted");
	}
}

type ProvisionDb = Pick<Database, "insert">;

export async function provisionSystemMailboxes(
	db: ProvisionDb,
	domainId: string,
	domainName: string,
): Promise<void> {
	const now = new Date();
	const postmasterId = crypto.randomUUID();

	await db.insert(mailboxes).values({
		id: postmasterId,
		domainId,
		localPart: SYSTEM_POSTMASTER_LOCAL_PART,
		address: buildEmailAddress(SYSTEM_POSTMASTER_LOCAL_PART, domainName),
		type: "system",
		aliasTargetId: null,
		aliasTargetAddress: null,
		isActive: true,
		createdAt: now,
		updatedAt: now,
	});

	for (const localPart of SYSTEM_ALIAS_LOCAL_PARTS) {
		await db.insert(mailboxes).values({
			id: crypto.randomUUID(),
			domainId,
			localPart,
			address: buildEmailAddress(localPart, domainName),
			type: "alias",
			aliasTargetId: postmasterId,
			aliasTargetAddress: null,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	}
}
