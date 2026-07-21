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

export { MIN_PASSWORD_LENGTH };
