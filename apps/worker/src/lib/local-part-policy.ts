export type LocalPartProfileInput = {
	firstName?: string;
	lastName?: string;
};

const TOKEN_PATTERN = /\{(first_name|last_name|last_name_initial)\}/g;

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

export function applyLocalPartPattern(
	pattern: string,
	profile: LocalPartProfileInput,
): string {
	const firstName = slugifyNamePart(profile.firstName ?? "");
	const lastName = slugifyNamePart(profile.lastName ?? "");
	const lastInitial = lastName ? lastName[0] ?? "" : "";

	const rendered = pattern.replace(TOKEN_PATTERN, (_match, token: string) => {
		switch (token) {
			case "first_name":
				return firstName;
			case "last_name":
				return lastName;
			case "last_name_initial":
				return lastInitial;
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

export function assertLocalPartMatchesPolicy(
	localPart: string,
	pattern: string,
	profile: LocalPartProfileInput,
	enforce: boolean,
): void {
	if (!enforce) {
		return;
	}
	const expected = applyLocalPartPattern(pattern, profile);
	if (!expected) {
		throw new Error("Local part policy could not be applied from profile fields");
	}
	if (localPart !== expected) {
		throw new Error(
			`Local part must match domain policy (${expected})`,
		);
	}
}
