import {
	buildSignatureTagContext,
	resolveFromName,
	resolveSignatureTags,
} from "@/lib/identities/name-pattern";
import type { Identity } from "@/lib/identities/api";
import type { IdentityNamePattern } from "@/lib/identities/name-pattern";

export const SIGNATURE_ATTR = "data-flaremail-signature";

/** Resolve identity signature HTML with tags substituted. Empty → null. */
export function resolveIdentitySignatureHtml(input: {
	identity: Identity | null | undefined;
	profile: { firstName: string; lastName: string };
	mailboxAddress: string;
	primaryAddress: string;
}): string | null {
	if (!input.identity?.signatureHtml?.trim()) {
		return null;
	}

	const fromName = resolveFromName(
		input.identity.namePattern as IdentityNamePattern,
		input.profile,
		input.identity.customName,
	);

	const resolved = resolveSignatureTags(
		input.identity.signatureHtml,
		buildSignatureTagContext({
			fromName,
			profile: input.profile,
			mailboxAddress: input.mailboxAddress,
			primaryAddress: input.primaryAddress,
		}),
	).trim();

	return resolved || null;
}
