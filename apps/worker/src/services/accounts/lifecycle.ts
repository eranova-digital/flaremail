import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	accountDomainAssignments,
	accounts,
} from "../../db/schema";
import type { AccountRole, Principal } from "../../lib/auth/types";
import { authorizeAccount } from "../../lib/auth/access";
import { deleteMailboxCascade } from "../cascade-delete";
import { deleteAccountProfilePictures } from "./profile-picture";

export async function assignRole(
	db: Database,
	principal: Principal,
	input: {
		accountId: string;
		role: AccountRole;
		domainIds?: string[];
	},
) {
	await authorizeAccount(db, principal, input.accountId, "manage_security");
	await authorizeAccount(db, principal, input.accountId, "assign_invite_role", {
		inviteRole: input.role,
	});

	if (principal.role === "admin" && input.domainIds?.length) {
		for (const domainId of input.domainIds) {
			if (!principal.domainIds.includes(domainId)) {
				throw new Error("Forbidden");
			}
		}
	}

	await db
		.update(accounts)
		.set({ role: input.role, updatedAt: new Date() })
		.where(eq(accounts.id, input.accountId));

	if (input.domainIds?.length) {
		await db
			.delete(accountDomainAssignments)
			.where(eq(accountDomainAssignments.accountId, input.accountId));
		await db.insert(accountDomainAssignments).values(
			input.domainIds.map((domainId) => ({
				accountId: input.accountId,
				domainId,
			})),
		);
	}
}

export async function suspendAccount(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await authorizeAccount(db, principal, accountId, "manage_security");

	const [target] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}
	if (target.isIntendant) {
		throw new Error("Cannot suspend intendant");
	}

	const now = new Date();
	await db
		.update(accounts)
		.set({ status: "suspended", suspendedAt: now, updatedAt: now })
		.where(eq(accounts.id, accountId));
}

export async function unsuspendAccount(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await authorizeAccount(db, principal, accountId, "manage_security");
	const now = new Date();
	await db
		.update(accounts)
		.set({ status: "active", suspendedAt: null, updatedAt: now })
		.where(eq(accounts.id, accountId));
}

export async function removeAccount(
	db: Database,
	bucket: R2Bucket,
	principal: Principal,
	accountId: string,
) {
	const [target] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!target) {
		throw new Error("Account not found");
	}

	await authorizeAccount(db, principal, accountId, "remove", {
		removeTarget: target,
	});

	if (target.primaryMailboxId) {
		await deleteMailboxCascade(db, bucket, target.primaryMailboxId);
	}

	await deleteAccountProfilePictures(db, bucket, accountId);

	await db.delete(accounts).where(eq(accounts.id, accountId));
}
