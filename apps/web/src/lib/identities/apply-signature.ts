import {
	buildSignatureTagContext,
	resolveFromName,
	resolveSignatureTags,
} from "@/lib/identities/name-pattern";
import type { Identity } from "@/lib/identities/api";
import type { IdentityNamePattern } from "@/lib/identities/name-pattern";

export const SIGNATURE_ATTR = "data-flaremail-signature";

export function applyIdentitySignatureHtml(input: {
	bodyHtml: string;
	identity: Identity | null | undefined;
	profile: { firstName: string; lastName: string };
	mailboxAddress: string;
	primaryAddress: string;
}): string {
	const doc = new DOMParser().parseFromString(
		`<div id="root">${input.bodyHtml}</div>`,
		"text/html",
	);
	const root = doc.getElementById("root");
	if (!root) {
		return input.bodyHtml;
	}

	for (const node of [...root.querySelectorAll(`[${SIGNATURE_ATTR}]`)]) {
		node.remove();
	}

	if (!input.identity?.signatureHtml?.trim()) {
		return root.innerHTML;
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
	);

	const wrapper = doc.createElement("div");
	wrapper.setAttribute(SIGNATURE_ATTR, "1");
	wrapper.innerHTML = resolved;

	const quote =
		root.querySelector('blockquote.quote[type="cite"]') ??
		root.querySelector("[data-type='replyQuote']");
	if (quote?.parentElement === root) {
		root.insertBefore(wrapper, quote);
	} else {
		root.appendChild(wrapper);
	}

	return root.innerHTML;
}
