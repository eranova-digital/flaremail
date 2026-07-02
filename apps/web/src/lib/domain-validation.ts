import type {
	DomainReadinessSummary,
	DomainValidationCheck,
} from "@/lib/api/client";

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

export function getValidationCheckMeta(
	key: ValidationCheckKey,
	domainName: string,
): ValidationCheckMeta {
	const postmaster = `postmaster@${domainName}`;
	const noreply = `noreply@${domainName}`;

	const meta: Record<ValidationCheckKey, Omit<ValidationCheckMeta, "key">> = {
		mx: {
			title: "MX records",
			tier: "critical",
			summary: "Inbound mail needs MX DNS records for the domain.",
			description:
				"Mail servers look up MX records to know where to deliver email for your domain. Without them, nothing can reach Flaremail.",
			passHint: "At least one MX record exists for this domain.",
			failHint:
				"No MX records were found. Configure Cloudflare Email Routing and wait for DNS to propagate, then recheck.",
		},
		dmarc_rua: {
			title: "DMARC aggregate reports",
			tier: "advisory",
			summary: `DMARC rua should include mailto:${postmaster}.`,
			description:
				`DMARC lives at _dmarc.${domainName}. The rua tag tells receivers where to send aggregate authentication reports. Pointing rua at ${postmaster} keeps reports inside your platform.`,
			passHint: `A DMARC TXT record includes mailto:${postmaster} in its rua tag.`,
			failHint:
				"DMARC is missing or its rua tag does not include the postmaster address. Mail still flows; this is a best-practice recommendation.",
		},
		loop_send: {
			title: "Outbound send",
			tier: "critical",
			summary: `Can Flaremail send mail from ${noreply}?`,
			description:
				`Sends a validation message from ${noreply} to ${postmaster} through Cloudflare Email Sending. Confirms your domain is authorized to send and the outbound path works.`,
			passHint: `Validation email was accepted for delivery from ${noreply}.`,
			failHint:
				"Sending failed. Check that Email Routing and Sending are enabled for this domain in Cloudflare.",
		},
		loop_receive: {
			title: "Inbound delivery",
			tier: "critical",
			summary: `Does mail reach ${postmaster}?`,
			description:
				`Waits for the validation email to arrive at ${postmaster} via your live routing setup. The run completes as soon as the message is received, or fails after a 10-minute deadline.`,
			passHint: `Validation email was received at ${postmaster}.`,
			failHint:
				"The validation email never arrived. Routing may still be propagating, or inbound rules may not be pointing to this worker.",
		},
	};

	return { key, ...meta[key] };
}

export const BADGE_META: Record<
	ReadinessBadge,
	{ label: string; headline: string; description: string }
> = {
	checking: {
		label: "Checking",
		headline: "Validation in progress",
		description:
			"DNS checks and the email loop are running. This page refreshes automatically until the run finishes.",
	},
	healthy: {
		label: "Healthy",
		headline: "Mail flow looks good",
		description:
			"All critical and advisory checks passed. Your domain is configured correctly for sending and receiving.",
	},
	unhealthy: {
		label: "Unhealthy",
		headline: "Mail works, but something is off",
		description:
			"Critical checks passed so mail can flow, but at least one advisory check failed. Review the recommendations below.",
	},
	fail: {
		label: "Failed",
		headline: "Mail flow is not verified",
		description:
			"At least one critical check failed. Mail may not send or receive reliably until the issues below are fixed.",
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
		return "—";
	}
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
