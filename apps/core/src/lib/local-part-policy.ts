export {
	applyLocalPartPattern,
	generatePatternRandomValues,
	getProfileFieldsUsedByPattern,
	isValidMailboxLocalPart,
	slugifyNamePart,
	type LocalPartProfileInput,
	type PatternRandomValues,
	type PolicyProfileField,
} from "@flaremail/local-part-policy";

import {
	applyLocalPartPattern,
	generatePatternRandomValues,
	isValidMailboxLocalPart,
	type LocalPartProfileInput,
	type PatternRandomValues,
} from "@flaremail/local-part-policy";

export function resolveLocalPartForInvite(input: {
	pattern: string | null;
	enforced: boolean;
	inviterIsManager: boolean;
	profile: LocalPartProfileInput;
	requestedLocalPart: string;
}): { localPart: string; random: PatternRandomValues } {
	const random = generatePatternRandomValues();

	if (input.enforced && input.inviterIsManager && input.pattern) {
		const localPart = applyLocalPartPattern(input.pattern, input.profile, random);
		if (!localPart || !isValidMailboxLocalPart(localPart)) {
			throw new Error("Local part policy could not be applied from profile fields");
		}
		return { localPart, random };
	}

	const localPart = input.requestedLocalPart.trim().toLowerCase();
	if (!localPart || !isValidMailboxLocalPart(localPart)) {
		throw new Error("Invalid mailbox local part");
	}
	return { localPart, random };
}
