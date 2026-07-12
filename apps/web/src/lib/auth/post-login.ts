import type { Account } from "@/lib/auth/types";

export function getPostLoginPath(
	account: Account | null,
	from: string | undefined,
): string {
	if (from && from !== "/login" && from !== "/security-compliance") {
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
