import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accountProfiles, accounts, mailboxes } from "../../db/schema";
import type { Principal } from "../../lib/auth/types";
import { isPlatformPrincipal } from "../../lib/auth/principal";
import { toAccountListItem } from "./shared";

export async function listAccountsForPrincipal(db: Database, principal: Principal) {
	const rows = await db
		.select({
			account: accounts,
			profile: accountProfiles,
			domainId: mailboxes.domainId,
		})
		.from(accounts)
		.leftJoin(accountProfiles, eq(accountProfiles.accountId, accounts.id))
		.leftJoin(mailboxes, eq(mailboxes.id, accounts.primaryMailboxId))
		.where(eq(accounts.isIntendant, false))
		.orderBy(accounts.loginIdentifier);

	if (!isPlatformPrincipal(principal)) {
		const domainIds = principal.domainIds;
		if (domainIds.length === 0) {
			return [];
		}
		return rows
			.filter(
				(row) =>
					row.domainId && domainIds.includes(row.domainId),
			)
			.map((row) =>
				toAccountListItem(row.account, row.profile, row.domainId),
			);
	}

	return rows.map((row) =>
		toAccountListItem(row.account, row.profile, row.domainId),
	);
}
