import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { domainLocalPartPolicies } from "../../db/schema";
import type { Principal } from "../../lib/auth/types";
import { hasDomainAccess, isPlatformPrincipal } from "../../lib/auth/principal";
import {
	applyLocalPartPattern,
	generatePatternRandomValues,
	isValidMailboxLocalPart,
} from "../../lib/local-part-policy";
import type { LogContext } from "../../lib/logs/context";
import { safeEmitLog } from "../../lib/logs/emit";

export async function getDomainLocalPartPolicy(db: Database, domainId: string) {
	const [policy] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domainId))
		.limit(1);
	return {
		domainId,
		enforced: policy?.enforced ?? false,
		pattern: policy?.pattern ?? null,
	};
}

export async function updateDomainLocalPartPolicy(
	db: Database,
	principal: Principal,
	domainId: string,
	input: { enforced?: boolean; pattern?: string | null },
	logContext?: LogContext | null,
) {
	if (!isPlatformPrincipal(principal) && !hasDomainAccess(principal, domainId)) {
		throw new Error("Forbidden");
	}
	if (principal.role === "manager") {
		throw new Error("Forbidden");
	}

	const now = new Date();
	const [existing] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domainId))
		.limit(1);

	if (existing) {
		await db
			.update(domainLocalPartPolicies)
			.set({
				enforced: input.enforced ?? existing.enforced,
				pattern:
					input.pattern === undefined ? existing.pattern : input.pattern,
				updatedAt: now,
			})
			.where(eq(domainLocalPartPolicies.domainId, domainId));
	} else {
		await db.insert(domainLocalPartPolicies).values({
			domainId,
			enforced: input.enforced ?? false,
			pattern: input.pattern ?? null,
			updatedAt: now,
		});
	}

	const accountId = principal.accountId;
	if (accountId) {
		await safeEmitLog(db, {
			importance: 5,
			type: "domains",
			summary: "{actor} updated local-part policy for {domain}",
			refs: {
				actor: { kind: "account", id: accountId },
				domain: { kind: "domain", id: domainId },
			},
			actorAccountId: accountId,
			context: logContext,
		});
	} else {
		await safeEmitLog(db, {
			importance: 5,
			type: "domains",
			summary: "Updated local-part policy for {domain}",
			refs: {
				domain: { kind: "domain", id: domainId },
			},
			actorAccountId: null,
			context: logContext,
		});
	}

	return getDomainLocalPartPolicy(db, domainId);
}

export async function suggestInviteLocalPart(
	db: Database,
	domainId: string,
	profile: { firstName?: string; lastName?: string },
	inviterIsManager: boolean,
): Promise<string | null> {
	const [policy] = await db
		.select()
		.from(domainLocalPartPolicies)
		.where(eq(domainLocalPartPolicies.domainId, domainId))
		.limit(1);
	if (!policy?.pattern) {
		return null;
	}
	if (inviterIsManager && !policy.enforced) {
		return null;
	}
	const suggested = applyLocalPartPattern(
		policy.pattern,
		profile,
		generatePatternRandomValues(),
	);
	return suggested && isValidMailboxLocalPart(suggested) ? suggested : null;
}
