import type { AccountRole } from "@/lib/accounts/api";

export type RoleMeta = {
	label: string;
	description: string;
};

/**
 * Plain-language names and one-line capability summaries for account roles.
 * Internal identifiers (`superadmin`, `intendant`, …) stay in the API; the UI
 * always speaks in these terms.
 */
export const ROLE_META: Record<AccountRole, RoleMeta> = {
	user: {
		label: "User",
		description: "Sends and receives mail in their own and granted mailboxes.",
	},
	manager: {
		label: "Manager",
		description:
			"Everything a user can do, plus manages shared mailbox access on assigned domains.",
	},
	admin: {
		label: "Admin",
		description:
			"Manages mailboxes, users, and managers on their assigned domains.",
	},
	superadmin: {
		label: "Owner",
		description:
			"Full control over every domain, mailbox, and account on this instance.",
	},
};

export const INTENDANT_META: RoleMeta = {
	label: "Recovery account",
	description:
		"Break-glass account used to bootstrap and recover this instance.",
};

export function roleLabel(
	role: AccountRole | null | undefined,
	isIntendant = false,
): string {
	if (isIntendant) {
		return INTENDANT_META.label;
	}
	if (!role) {
		return "Unknown";
	}
	return ROLE_META[role].label;
}

export function roleDescription(
	role: AccountRole | null | undefined,
	isIntendant = false,
): string | null {
	if (isIntendant) {
		return INTENDANT_META.description;
	}
	if (!role) {
		return null;
	}
	return ROLE_META[role].description;
}

export type AccountStatusTone = "success" | "secondary" | "warning";

export function statusMeta(status: string): {
	label: string;
	tone: AccountStatusTone;
} {
	switch (status) {
		case "active":
			return { label: "Active", tone: "success" };
		case "pending":
			return { label: "Pending activation", tone: "warning" };
		case "suspended":
			return { label: "Suspended", tone: "secondary" };
		default:
			return { label: status, tone: "secondary" };
	}
}
