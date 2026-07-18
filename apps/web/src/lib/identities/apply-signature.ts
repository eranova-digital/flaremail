import {
	buildSignatureTagContext,
	resolveFromName,
	resolveSignatureTags,
} from "@test-worker/identity-name-pattern";
import type { Identity } from "@/lib/identities/api";
import type { IdentityNamePattern } from "@test-worker/identity-name-pattern";
import { isEmptyEditorHtml } from "@/lib/compose-body";

export const SIGNATURE_ATTR = "data-flaremail-signature";

/** True when signature HTML has no visible content (blank editor / whitespace-only). */
export function isBlankSignatureHtml(html: string | null | undefined): boolean {
	if (!html?.trim()) {
		return true;
	}
	if (isEmptyEditorHtml(html)) {
		return true;
	}
	const text = html
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
	return text.length === 0;
}

/** Resolve identity signature HTML with tags substituted. Empty → null. */
export function resolveIdentitySignatureHtml(input: {
	identity: Identity | null | undefined;
	profile: { firstName: string; lastName: string };
	mailboxAddress: string;
	primaryAddress: string;
}): string | null {
	const signatureHtml = input.identity?.signatureHtml;
	if (isBlankSignatureHtml(signatureHtml)) {
		return null;
	}

	const fromName = resolveFromName(
		input.identity!.namePattern as IdentityNamePattern,
		input.profile,
		input.identity!.customName,
	);

	const resolved = resolveSignatureTags(
		signatureHtml!,
		buildSignatureTagContext({
			fromName,
			profile: input.profile,
			mailboxAddress: input.mailboxAddress,
			primaryAddress: input.primaryAddress,
		}),
	);

	return isBlankSignatureHtml(resolved) ? null : resolved.trim();
}
