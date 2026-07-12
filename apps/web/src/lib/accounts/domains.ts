import type { Account } from "@/lib/auth/types";

export function isPlatformAccount(account: Account | null): boolean {
	return !!account && (account.isIntendant || account.role === "superadmin");
}

export function accessibleDomainIds(account: Account | null): string[] | null {
	if (!account) {
		return [];
	}
	if (isPlatformAccount(account)) {
		return null;
	}
	return account.domainIds ?? [];
}

export function filterDomainsForAccount<T extends { id?: string | null }>(
	account: Account | null,
	domains: T[],
): T[] {
	const allowed = accessibleDomainIds(account);
	if (allowed === null) {
		return domains;
	}
	if (allowed.length === 0) {
		return [];
	}
	return domains.filter((domain) => domain.id && allowed.includes(domain.id));
}
