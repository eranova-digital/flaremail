import { authenticate } from "mailauth";
import { Buffer } from "node:buffer";

import type { DmarcResult } from "../../db/schema";
import { dohResolver } from "../dns/doh-resolver";
import {
	computeBimiEligibility,
	isEnforcingPolicy,
} from "./eligibility";
import {
	extractClientIpFromAuthHeaders,
	parseTrustedDmarcFromHeaders,
} from "./parse-authentication-results";

export type InboundAuthResult = {
	dmarcResult: DmarcResult;
	/** Domain of the RFC5322.From address when DMARC ran; null when unavailable. */
	alignedDomain: string | null;
	/** Applied DMARC policy (p/sp), lowercased when present. */
	enforcingPolicy: boolean;
	policy: string | null;
	eligibleForBimi: boolean;
};

function normalizeDmarcResult(raw: string | undefined): DmarcResult {
	switch (raw) {
		case "pass":
			return "pass";
		case "fail":
			return "fail";
		case "none":
			return "none";
		case "temperror":
		case "temperr":
			return "temperror";
		case "permerror":
			return "permerror";
		default:
			return "none";
	}
}

function fromMailauthDmarc(dmarc: NonNullable<Awaited<ReturnType<typeof authenticate>>["dmarc"]>): InboundAuthResult {
	const dmarcResult = normalizeDmarcResult(dmarc.status?.result);
	const policy =
		typeof dmarc.policy === "string" ? dmarc.policy.toLowerCase() : null;
	const fromDomain =
		typeof dmarc.status?.header?.from === "string"
			? dmarc.status.header.from.toLowerCase().trim()
			: null;
	const hasAlignment = Boolean(
		dmarc.alignment?.dkim?.result || dmarc.alignment?.spf?.result,
	);
	const alignedDomain =
		dmarcResult === "pass" && hasAlignment && fromDomain ? fromDomain : null;
	const enforcingPolicy = isEnforcingPolicy(policy);
	const eligibleForBimi = computeBimiEligibility({
		dmarcResult,
		policy,
		alignedDomain,
	});

	return {
		dmarcResult,
		alignedDomain,
		enforcingPolicy,
		policy,
		eligibleForBimi,
	};
}

/**
 * Verify SPF/DKIM/DMARC for an inbound message. BIMI is disabled here —
 * we resolve logos ourselves after eligibility checks.
 *
 * When mailauth cannot reproduce Cloudflare's edge verdict, falls back to
 * trusted Authentication-Results stamped by mx.cloudflare.net.
 */
export async function verifyInboundAuth(
	rawMessage: ArrayBuffer | Uint8Array | string,
	options: {
		sender?: string;
		ip?: string;
		helo?: string;
		mta?: string;
		authenticationResults?: string | null;
		arcAuthenticationResults?: string | null;
		receivedSpf?: string | null;
	} = {},
): Promise<InboundAuthResult> {
	const input =
		typeof rawMessage === "string"
			? rawMessage
			: Buffer.from(
					rawMessage instanceof Uint8Array
						? rawMessage
						: new Uint8Array(rawMessage),
				);

	const ip =
		options.ip ??
		extractClientIpFromAuthHeaders(
			options.authenticationResults,
			options.receivedSpf,
		);

	const result = await authenticate(input, {
		sender: options.sender,
		ip,
		helo: options.helo,
		mta: options.mta,
		trustReceived: !ip,
		disableBimi: true,
		disableArc: true,
		resolver: dohResolver,
	});

	const dmarc = result.dmarc;
	if (dmarc) {
		const mailauthResult = fromMailauthDmarc(dmarc);
		if (mailauthResult.eligibleForBimi) {
			return mailauthResult;
		}
	}

	const trusted = parseTrustedDmarcFromHeaders(
		options.authenticationResults,
		options.arcAuthenticationResults,
	);
	if (trusted) {
		return {
			dmarcResult: trusted.dmarcResult,
			alignedDomain: trusted.alignedDomain,
			enforcingPolicy: isEnforcingPolicy(trusted.policy),
			policy: trusted.policy,
			eligibleForBimi: trusted.eligibleForBimi,
		};
	}

	if (dmarc) {
		return fromMailauthDmarc(dmarc);
	}

	return {
		dmarcResult: "none",
		alignedDomain: null,
		enforcingPolicy: false,
		policy: null,
		eligibleForBimi: false,
	};
}

export { computeBimiEligibility, isEnforcingPolicy };
