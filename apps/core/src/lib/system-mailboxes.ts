import type { Database } from "../db/client";
import { accounts, mailboxes } from "../db/schema";
import { eq } from "drizzle-orm";
import { buildEmailAddress } from "./normalize-email-address";

export const SYSTEM_POSTMASTER_LOCAL_PART = "postmaster";
export const SYSTEM_BLACKHOLE_LOCAL_PART = "noreply";
export const SYSTEM_ALIAS_LOCAL_PARTS = ["abuse"] as const;

const SYSTEM_MANAGED_LOCAL_PARTS = [
	SYSTEM_POSTMASTER_LOCAL_PART,
	SYSTEM_BLACKHOLE_LOCAL_PART,
	...SYSTEM_ALIAS_LOCAL_PARTS,
] as const;

export function isSystemManagedLocalPart(localPart: string | null | undefined): boolean {
	if (!localPart) {
		return false;
	}
	const normalized = localPart.trim().toLowerCase();
	return (SYSTEM_MANAGED_LOCAL_PARTS as readonly string[]).includes(normalized);
}

export function isSystemManagedMailbox(mailbox: {
	type: string;
	localPart?: string | null;
	isSystemManaged?: boolean;
}): boolean {
	if (mailbox.isSystemManaged) {
		return true;
	}
	return (
		mailbox.type === "system" ||
		mailbox.type === "blackhole" ||
		isSystemManagedLocalPart(mailbox.localPart)
	);
}

export function assertMailboxMutable(mailbox: {
	type: string;
	localPart: string;
}): void {
	if (isSystemManagedMailbox(mailbox)) {
		throw new Error("System mailboxes cannot be modified or deleted");
	}
	if (mailbox.type === "primary") {
		throw new Error(
			"Primary mailboxes cannot be deleted directly. Remove the associated account instead.",
		);
	}
}

export async function assertMailboxNotPrimaryAccount(
	db: Database,
	mailboxId: string,
): Promise<void> {
	const [account] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(eq(accounts.primaryMailboxId, mailboxId))
		.limit(1);
	if (account) {
		throw new Error(
			"Primary mailboxes cannot be deleted directly. Remove the associated account instead.",
		);
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

	await db.insert(mailboxes).values({
		id: crypto.randomUUID(),
		domainId,
		localPart: SYSTEM_BLACKHOLE_LOCAL_PART,
		address: buildEmailAddress(SYSTEM_BLACKHOLE_LOCAL_PART, domainName),
		type: "blackhole",
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
