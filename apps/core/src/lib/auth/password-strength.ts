const MIN_PASSWORD_LENGTH = 8;

export type PasswordStrengthIssue =
	| "too-short"
	| "missing-letter"
	| "missing-number";

export function getPasswordStrengthIssues(
	password: string,
): PasswordStrengthIssue[] {
	const issues: PasswordStrengthIssue[] = [];
	if (password.length < MIN_PASSWORD_LENGTH) {
		issues.push("too-short");
	}
	if (!/[A-Za-z]/.test(password)) {
		issues.push("missing-letter");
	}
	if (!/\d/.test(password)) {
		issues.push("missing-number");
	}
	return issues;
}

export function isStrongPassword(password: string): boolean {
	return getPasswordStrengthIssues(password).length === 0;
}

export function assertStrongPassword(password: string): void {
	if (!isStrongPassword(password)) {
		throw new Error(
			"Password must be at least 8 characters and include a letter and a number",
		);
	}
}

export { MIN_PASSWORD_LENGTH };
