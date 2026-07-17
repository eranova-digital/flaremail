import type { Account } from "@/lib/auth/types";

/** Safe relative return paths for post-login OIDC resume. */
export function isSafeReturnTo(value: string | null | undefined): value is string {
	if (!value || !value.startsWith("/") || value.startsWith("//")) {
		return false;
	}
	if (value === "/login" || value === "/security-compliance") {
		return false;
	}
	return true;
}

/** API resume paths need a full navigation; SPA routes use the router. */
export function isFullPageReturnTo(value: string): boolean {
	return value.startsWith("/api/");
}

export function getPostLoginPath(
	account: Account | null,
	from: string | undefined,
): string {
	if (isSafeReturnTo(from)) {
		return from;
	}

	if (account?.isIntendant) {
		return "/";
	}

	if (account?.primaryMailboxId) {
		return `/m/${account.primaryMailboxId}/inbox`;
	}

	return "/";
}
