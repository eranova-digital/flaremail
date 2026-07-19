import type {
	DomainReadinessSummary,
	DomainValidationCheck,
} from "@/lib/api/client";
import i18n from "@/lib/i18n";

export type ValidationCheckKey =
	| "mx"
	| "dmarc_rua"
	| "loop_send"
	| "loop_receive";

export type ReadinessBadge = NonNullable<DomainReadinessSummary["badge"]>;

export const CHECK_ORDER: ValidationCheckKey[] = [
	"mx",
	"dmarc_rua",
	"loop_send",
	"loop_receive",
];

export type ValidationCheckMeta = {
	key: ValidationCheckKey;
	title: string;
	tier: "critical" | "advisory";
	summary: string;
	description: string;
	passHint: string;
	failHint: string;
};

const CHECK_TIERS: Record<ValidationCheckKey, "critical" | "advisory"> = {
	mx: "critical",
	dmarc_rua: "advisory",
	loop_send: "critical",
	loop_receive: "critical",
};

export function getValidationCheckMeta(
	key: ValidationCheckKey,
	domainName: string,
): ValidationCheckMeta {
	const postmaster = `postmaster@${domainName}`;
	const noreply = `noreply@${domainName}`;
	const vars = { postmaster, noreply, domainName };

	return {
		key,
		tier: CHECK_TIERS[key],
		title: i18n.t(`domainValidation.checks.${key}.title`, {
			ns: "management",
		}),
		summary: i18n.t(`domainValidation.checks.${key}.summary`, {
			ns: "management",
			...vars,
		}),
		description: i18n.t(`domainValidation.checks.${key}.description`, {
			ns: "management",
			...vars,
		}),
		passHint: i18n.t(`domainValidation.checks.${key}.passHint`, {
			ns: "management",
			...vars,
		}),
		failHint: i18n.t(`domainValidation.checks.${key}.failHint`, {
			ns: "management",
			...vars,
		}),
	};
}

function badgeMeta(badge: ReadinessBadge) {
	return {
		label: i18n.t(`domainValidation.badges.${badge}.label`, {
			ns: "management",
		}),
		headline: i18n.t(`domainValidation.badges.${badge}.headline`, {
			ns: "management",
		}),
		description: i18n.t(`domainValidation.badges.${badge}.description`, {
			ns: "management",
		}),
	};
}

/** Locale-aware; prefer reading via getters so language changes apply. */
export const BADGE_META: Record<
	ReadinessBadge,
	{ label: string; headline: string; description: string }
> = {
	get checking() {
		return badgeMeta("checking");
	},
	get healthy() {
		return badgeMeta("healthy");
	},
	get unhealthy() {
		return badgeMeta("unhealthy");
	},
	get fail() {
		return badgeMeta("fail");
	},
};

export function sortChecks(
	checks: DomainValidationCheck[],
): DomainValidationCheck[] {
	const order = new Map(
		CHECK_ORDER.map((key, index) => [key, index] as const),
	);
	return [...checks].sort((left, right) => {
		const leftIndex = order.get(left.checkKey ?? "mx") ?? 0;
		const rightIndex = order.get(right.checkKey ?? "mx") ?? 0;
		return leftIndex - rightIndex;
	});
}

export function formatValidationTimestamp(value: string | null | undefined) {
	if (!value) {
		return i18n.t("domainValidation.emDash", { ns: "management" });
	}
	return new Intl.DateTimeFormat(i18n.language, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
