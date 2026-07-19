import type { AccountRole } from "@/lib/accounts/api";
import i18n from "@/lib/i18n";

export type RoleMeta = {
	label: string;
	description: string;
};

export function roleMeta(
	role: AccountRole,
): RoleMeta {
	return {
		label: i18n.t(`roles.${role}.label`, { ns: "common" }),
		description: i18n.t(`roles.${role}.description`, { ns: "common" }),
	};
}

export function intendantMeta(): RoleMeta {
	return {
		label: i18n.t("roles.intendant.label", { ns: "common" }),
		description: i18n.t("roles.intendant.description", { ns: "common" }),
	};
}

/** @deprecated Prefer roleMeta() / intendantMeta() for locale-aware copy. */
export const ROLE_META: Record<AccountRole, RoleMeta> = {
	get user() {
		return roleMeta("user");
	},
	get manager() {
		return roleMeta("manager");
	},
	get admin() {
		return roleMeta("admin");
	},
	get superadmin() {
		return roleMeta("superadmin");
	},
};

/** @deprecated Prefer intendantMeta(). */
export const INTENDANT_META: RoleMeta = {
	get label() {
		return intendantMeta().label;
	},
	get description() {
		return intendantMeta().description;
	},
};

export function roleLabel(
	role: AccountRole | null | undefined,
	isIntendant = false,
): string {
	if (isIntendant) {
		return intendantMeta().label;
	}
	if (!role) {
		return i18n.t("unknown", { ns: "common" });
	}
	return roleMeta(role).label;
}

export function roleDescription(
	role: AccountRole | null | undefined,
	isIntendant = false,
): string | null {
	if (isIntendant) {
		return intendantMeta().description;
	}
	if (!role) {
		return null;
	}
	return roleMeta(role).description;
}

export type AccountStatusTone = "success" | "secondary" | "warning";

export function statusMeta(status: string): {
	label: string;
	tone: AccountStatusTone;
} {
	switch (status) {
		case "active":
			return {
				label: i18n.t("statusValues.active", { ns: "common" }),
				tone: "success",
			};
		case "pending":
			return {
				label: i18n.t("statusValues.pending", { ns: "common" }),
				tone: "warning",
			};
		case "suspended":
			return {
				label: i18n.t("statusValues.suspended", { ns: "common" }),
				tone: "secondary",
			};
		default:
			return { label: status, tone: "secondary" };
	}
}
