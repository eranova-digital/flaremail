export type SystemEmailTemplateKey =
	| "invite"
	| "password_reset"
	| "recovery_verify"
	| "mfa_disable";

export type SystemEmailTemplateTag = {
	name: string;
	description: string;
};

export type SystemEmailTemplateDefinition = {
	key: SystemEmailTemplateKey;
	label: string;
	description: string;
	subject: string;
	tags: readonly SystemEmailTemplateTag[];
	expiresIn: string;
};

export const SYSTEM_EMAIL_TEMPLATE_DEFINITIONS: readonly SystemEmailTemplateDefinition[] =
	[
		{
			key: "invite",
			label: "Account invite",
			description:
				"Sent when inviting a new account with email delivery enabled.",
			subject: "Your Flaremail invite code",
			expiresIn: "7 days",
			tags: [
				{
					name: "invite_code",
					description: "The XXXX-XXXX invite activation code",
				},
				{ name: "code", description: "Alias for invite_code" },
				{
					name: "expires_in",
					description: 'How long the code is valid (e.g. "7 days")',
				},
			],
		},
		{
			key: "password_reset",
			label: "Password reset",
			description:
				"Sent when a user requests a password reset to their recovery email. Flaremail uses a code (not a reset link).",
			subject: "Reset your Flaremail password",
			expiresIn: "24 hours",
			tags: [
				{
					name: "reset_code",
					description: "The XXXX-XXXX password reset code",
				},
				{ name: "code", description: "Alias for reset_code" },
				{
					name: "expires_in",
					description: 'How long the code is valid (e.g. "24 hours")',
				},
			],
		},
		{
			key: "recovery_verify",
			label: "Recovery email verification",
			description: "Sent when a user sets or changes their recovery email.",
			subject: "Verify your Flaremail recovery email",
			expiresIn: "15 minutes",
			tags: [
				{
					name: "verification_code",
					description: "The XXXX-XXXX verification code",
				},
				{ name: "code", description: "Alias for verification_code" },
				{
					name: "expires_in",
					description: 'How long the code is valid (e.g. "15 minutes")',
				},
			],
		},
		{
			key: "mfa_disable",
			label: "Disable two-factor authentication",
			description:
				"Sent when a user requests a recovery code to disable MFA.",
			subject: "Disable two-factor authentication on your Flaremail account",
			expiresIn: "15 minutes",
			tags: [
				{
					name: "verification_code",
					description: "The XXXX-XXXX verification code",
				},
				{ name: "code", description: "Alias for verification_code" },
				{
					name: "expires_in",
					description: 'How long the code is valid (e.g. "15 minutes")',
				},
			],
		},
	] as const;

const DEFINITION_BY_KEY = new Map(
	SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.map((item) => [item.key, item]),
);

export function isSystemEmailTemplateKey(
	value: string,
): value is SystemEmailTemplateKey {
	return DEFINITION_BY_KEY.has(value as SystemEmailTemplateKey);
}

export function getSystemEmailTemplateDefinition(
	key: SystemEmailTemplateKey,
): SystemEmailTemplateDefinition {
	const definition = DEFINITION_BY_KEY.get(key);
	if (!definition) {
		throw new Error(`Unknown system email template '${key}'`);
	}
	return definition;
}

export function systemEmailTemplateStorageKey(
	key: SystemEmailTemplateKey,
): string {
	return `templates/system/${key}.html`;
}

/** Replace `{tag}` placeholders. Unknown tags are left unchanged. */
export function applySystemTemplateTags(
	html: string,
	values: Record<string, string>,
): string {
	let result = html;
	for (const [name, value] of Object.entries(values)) {
		if (!name.trim()) {
			continue;
		}
		result = result.replaceAll(`{${name}}`, value);
	}
	return result;
}
