export const IDENTITY_NAME_PATTERNS = [
	"none",
	"first_name",
	"last_name",
	"first_name_last_name",
	"last_name_first_name",
	"first_initial_last_name",
	"last_name_first_initial",
	"first_name_last_initial",
	"last_initial_first_name",
	"custom",
] as const;

export type IdentityNamePattern = (typeof IDENTITY_NAME_PATTERNS)[number];

export type IdentityProfileInput = {
	firstName?: string;
	lastName?: string;
};

export type SignatureTagContext = {
	fromName: string;
	firstName: string;
	lastName: string;
	firstInitial: string;
	lastInitial: string;
	mailboxAddress: string;
	primaryAddress: string;
};

const SIGNATURE_TAG_PATTERN =
	/\{(from_name|first_name|last_name|first_initial|last_initial|mailbox_address|primary_address)\}/g;

export function isIdentityNamePattern(
	value: unknown,
): value is IdentityNamePattern {
	return (
		typeof value === "string" &&
		(IDENTITY_NAME_PATTERNS as readonly string[]).includes(value)
	);
}

function initialOf(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}
	return trimmed[0]!.toLocaleUpperCase();
}

export function profileNameParts(profile: IdentityProfileInput): {
	firstName: string;
	lastName: string;
	firstInitial: string;
	lastInitial: string;
} {
	const firstName = (profile.firstName ?? "").trim();
	const lastName = (profile.lastName ?? "").trim();
	return {
		firstName,
		lastName,
		firstInitial: initialOf(firstName),
		lastInitial: initialOf(lastName),
	};
}

/** Collapse internal whitespace and trim; omit empty segments. */
export function joinNameSegments(...segments: string[]): string {
	return segments
		.map((segment) => segment.trim())
		.filter(Boolean)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

export function resolveFromName(
	pattern: IdentityNamePattern,
	profile: IdentityProfileInput,
	customName?: string | null,
): string {
	if (pattern === "none") {
		return "";
	}
	if (pattern === "custom") {
		return (customName ?? "").trim();
	}

	const { firstName, lastName, firstInitial, lastInitial } =
		profileNameParts(profile);

	switch (pattern) {
		case "first_name":
			return firstName;
		case "last_name":
			return lastName;
		case "first_name_last_name":
			return joinNameSegments(firstName, lastName);
		case "last_name_first_name":
			return joinNameSegments(lastName, firstName);
		case "first_initial_last_name":
			return joinNameSegments(firstInitial, lastName);
		case "last_name_first_initial":
			return joinNameSegments(lastName, firstInitial);
		case "first_name_last_initial":
			return joinNameSegments(firstName, lastInitial);
		case "last_initial_first_name":
			return joinNameSegments(lastInitial, firstName);
		default: {
			const _exhaustive: never = pattern;
			return _exhaustive;
		}
	}
}

export function buildSignatureTagContext(input: {
	fromName: string;
	profile: IdentityProfileInput;
	mailboxAddress: string;
	primaryAddress: string;
}): SignatureTagContext {
	const parts = profileNameParts(input.profile);
	return {
		fromName: input.fromName,
		firstName: parts.firstName,
		lastName: parts.lastName,
		firstInitial: parts.firstInitial,
		lastInitial: parts.lastInitial,
		mailboxAddress: input.mailboxAddress,
		primaryAddress: input.primaryAddress,
	};
}

export function resolveSignatureTags(
	html: string,
	context: SignatureTagContext,
): string {
	return html.replace(SIGNATURE_TAG_PATTERN, (_match, tag: string) => {
		switch (tag) {
			case "from_name":
				return context.fromName;
			case "first_name":
				return context.firstName;
			case "last_name":
				return context.lastName;
			case "first_initial":
				return context.firstInitial;
			case "last_initial":
				return context.lastInitial;
			case "mailbox_address":
				return context.mailboxAddress;
			case "primary_address":
				return context.primaryAddress;
			default:
				return `{${tag}}`;
		}
	});
}
