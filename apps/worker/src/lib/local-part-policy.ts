export type LocalPartProfileInput = {
	firstName?: string;
	lastName?: string;
};

export type PatternRandomValues = {
	rndNum: string;
	rndChar: string;
};

export type PolicyProfileField = "firstName" | "lastName";

const TOKEN_PATTERN =
	/\{(first_name|last_name|first_name_initial|last_name_initial|rnd_num|rnd_char)\}/g;

export function slugifyNamePart(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, ".")
		.replace(/^\.+|\.+$/g, "")
		.replace(/\.{2,}/g, ".");
}

export function generatePatternRandomValues(): PatternRandomValues {
	return {
		rndNum: String(Math.floor(1000 + Math.random() * 9000)),
		rndChar: String.fromCharCode(97 + Math.floor(Math.random() * 26)),
	};
}

export function getProfileFieldsUsedByPattern(pattern: string): PolicyProfileField[] {
	const fields = new Set<PolicyProfileField>();
	for (const match of pattern.matchAll(TOKEN_PATTERN)) {
		const token = match[1];
		if (token.startsWith("first_name")) {
			fields.add("firstName");
		}
		if (token.startsWith("last_name")) {
			fields.add("lastName");
		}
	}
	return [...fields];
}

export function applyLocalPartPattern(
	pattern: string,
	profile: LocalPartProfileInput,
	random: PatternRandomValues = generatePatternRandomValues(),
): string {
	const firstName = slugifyNamePart(profile.firstName ?? "");
	const lastName = slugifyNamePart(profile.lastName ?? "");
	const firstInitial = firstName ? firstName[0] ?? "" : "";
	const lastInitial = lastName ? lastName[0] ?? "" : "";

	const rendered = pattern.replace(TOKEN_PATTERN, (_match, token: string) => {
		switch (token) {
			case "first_name":
				return firstName;
			case "last_name":
				return lastName;
			case "first_name_initial":
				return firstInitial;
			case "last_name_initial":
				return lastInitial;
			case "rnd_num":
				return random.rndNum;
			case "rnd_char":
				return random.rndChar;
			default:
				return "";
		}
	});

	return rendered.replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
}

export function isValidMailboxLocalPart(localPart: string): boolean {
	if (!localPart || localPart.length > 64) {
		return false;
	}
	return /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(localPart);
}

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
