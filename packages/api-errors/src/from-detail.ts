import type { ApiErrorCode } from "./codes";

/**
 * Maps known English `detail` / `Error.message` values to stable codes.
 * Used by the worker so clients can translate via code without worker-side i18n.
 */
const DETAIL_TO_CODE: Record<string, ApiErrorCode> = {
	"Bad request": "bad-request",
	"Authentication required": "authentication-required",
	"Invalid credentials": "invalid-credentials",
	"Invalid token": "invalid-token",
	"Session expired": "session-expired",
	"Session invalid": "session-invalid",
	"Invalid API key": "invalid-api-key",
	"API keys cannot access this endpoint": "api-keys-cannot-access",
	"This endpoint requires an authenticated session": "session-required",
	"Account is suspended": "account-suspended",
	"Account is not activated": "account-not-activated",
	"Account not found": "account-not-found",
	"Invalid or expired invite code": "invalid-or-expired-invite-code",
	"Invite is no longer valid": "invite-no-longer-valid",
	"Invalid or expired reset code": "invalid-or-expired-reset-code",
	"Invalid or expired verification code": "invalid-or-expired-verification-code",
	"Method not allowed": "method-not-allowed",
	"Thread has no messages to reply to": "thread-has-no-messages-to-reply-to",
	"WebAuthn origin is not allowed": "webauthn-origin-not-allowed",
	"Invalid MFA challenge": "invalid-mfa-challenge",
	"Invalid passkey challenge": "invalid-passkey-challenge",
	"Challenge already used": "challenge-already-used",
	"Invalid authentication code": "invalid-authentication-code",
	"Authenticator code is required": "authenticator-code-required",
	"Two-factor authentication is not enabled": "mfa-not-enabled",
	"Two-factor authentication is not enabled for this account":
		"mfa-not-enabled-for-account",
	"Two-factor authentication is already enabled": "mfa-already-enabled",
	"Start two-factor setup before confirming": "start-mfa-setup-before-confirming",
	"Only the intendant can regenerate this password":
		"only-intendant-can-regenerate-password",
	"Only the intendant can regenerate": "only-intendant-can-regenerate",
	"Cannot modify your own assignments": "cannot-modify-own-assignments",
	"Only admins can change manager domain or shared-mailbox scope":
		"only-admins-can-change-manager-scope",
	"Catch-all mailbox must be an active receiving mailbox on this domain":
		"catch-all-mailbox-invalid",
	"Domain already exists": "domain-already-exists",
	"Domain not found": "domain-not-found",
	"Attachment not found": "attachment-not-found",
	"Attachment content not found": "attachment-content-not-found",
	"Image not found": "image-not-found",
	"Message not found": "message-not-found",
	"Invalid email address": "invalid-email-address",
	"Mailbox address is required": "mailbox-address-required",
	"Passkey id is required": "passkey-id-required",
	"password is required": "password-required",
	"email and password are required": "email-and-password-required",
	"code and password are required": "code-and-password-required",
	"code is required": "code-required",
	"address is required": "address-required",
	"mfaToken and code are required": "mfa-token-and-code-required",
	"challengeToken and response are required":
		"challenge-token-and-response-required",
	"code query parameter is required": "code-query-parameter-required",
	"Unsupported grant_type": "unsupported-grant-type",
	"Cannot suspend intendant": "cannot-suspend-intendant",
	"The intendant account cannot be managed": "intendant-cannot-be-managed",
	"Cannot update intendant assignments": "cannot-update-intendant-assignments",
	"Assignments only apply to admin or manager accounts":
		"assignments-admin-or-manager-only",
	"Forbidden domain assignment": "forbidden-domain-assignment",
	"Forbidden shared mailbox assignment": "forbidden-shared-mailbox-assignment",
	"Invalid shared mailbox assignment": "invalid-shared-mailbox-assignment",
	"Mailbox grants cannot apply to the intendant account":
		"mailbox-grants-not-for-intendant",
	Forbidden: "forbidden",
	"Invalid Content-Length": "invalid-content-length",
	"Request body is too large": "request-body-too-large",
	"Request body must be valid JSON": "request-body-must-be-valid-json",
	"Rate limit exceeded": "rate-limit-exceeded",
	"The requested resource was not found": "not-found",
	"Internal server error": "internal-error",
	"Mailbox not found": "mailbox-not-found",
	"Mailbox already exists": "mailbox-already-exists",
	"Mailbox is not active": "mailbox-not-active",
	"Mailbox not found or cannot send": "mailbox-cannot-send",
	"Identity not found": "identity-not-found",
	"Label not found": "label-not-found",
	"Label already exists for this mailbox": "label-already-exists",
	"Thread not found": "thread-not-found",
	"Draft not found": "draft-not-found",
	"Stored draft not found": "draft-not-found",
	"Updated draft not found": "draft-not-found",
	"Template not found": "template-not-found",
	"OIDC client not found": "oidc-client-not-found",
	"Consent grant not found": "consent-grant-not-found",
	"Pending authorization not found": "pending-authorization-not-found",
	"Passkey not found": "passkey-not-found",
	"Passkey not recognized": "passkey-not-recognized",
	"No passkeys are registered for this account": "no-passkeys-registered",
	"Passkey does not belong to this account": "passkey-does-not-belong",
	"Passkey registration could not be verified": "passkey-registration-failed",
	"Passkey sign-in could not be verified": "passkey-sign-in-failed",
	"Invalid passkey response": "invalid-passkey-response",
	"Password must be at least 8 characters and include a letter and a number":
		"password-too-weak",
	"Invalid password": "invalid-password",
	"The intendant cannot change this password":
		"intendant-cannot-change-password",
	"New password must be different from the current password":
		"new-password-must-differ",
	"currentPassword and newPassword are required":
		"current-and-new-password-required",
	"Invalid recovery email address": "invalid-recovery-email",
	"Recovery email cannot use a mailbox domain hosted by this instance":
		"recovery-email-hosted-domain",
	"Recovery email cannot use a mailbox hosted by this instance":
		"recovery-email-hosted-mailbox",
	"Phone number must be a valid international number in E.164 format (e.g. +14155552671)":
		"invalid-phone-number",
	"This recovery email is already in use by another account":
		"recovery-email-in-use",
	"No recovery email configured": "no-recovery-email-configured",
	"You haven't configured a recovery email. Please ask a supervisor for a recovery code.":
		"no-recovery-email",
	"Eligible account required": "eligible-account-required",
	"Expected multipart form data": "expected-multipart-form-data",
	"Invalid form data": "invalid-form-data",
	"file is required": "file-required",
	"name is required": "name-required",
	"name and redirectUris are required": "name-and-redirect-uris-required",
	"No valid fields were provided": "no-valid-fields-provided",
	"No valid settings were provided": "no-valid-settings-provided",
	"Invalid folder query parameter": "invalid-folder-query-parameter",
	"email is required": "email-required",
	"email and code are required": "email-and-code-required",
	"password and code are required": "password-and-code-required",
	"domainId is required": "domain-id-required",
	"domainId and localPart are required": "domain-id-and-local-part-required",
	"accountId and role are required": "account-id-and-role-required",
	"mailboxId is required": "mailbox-id-required",
	"Identity id is required": "identity-id-required",
	"namePattern is required": "name-pattern-required",
	"pendingId and decision are required": "pending-id-and-decision-required",
	"from must be a valid ISO datetime": "from-must-be-iso-datetime",
	"to must be a valid ISO datetime": "to-must-be-iso-datetime",
	"Search query is required": "search-query-required",
	"Invalid search query": "invalid-search-query",
	"Unknown search operator": "unknown-search-operator",
	"Empty search operator value": "empty-search-operator-value",
	"Unclosed quote in search query": "unclosed-search-quote",
	"Unclosed parenthesis in search query": "unclosed-search-paren",
	"Invalid search date": "invalid-search-date",
	"Invalid search folder": "invalid-search-folder",
	"Invalid search is: value": "invalid-search-is-value",
	"Invalid search has: value": "invalid-search-has-value",
	"Invalid domain name": "invalid-domain-name",
	"Invalid mailbox address": "invalid-mailbox-address",
	"Invalid mailbox local part": "invalid-mailbox-local-part",
	"Address domain does not match domainId": "address-domain-mismatch",
	"Address is reserved for system mailboxes": "address-reserved-for-system",
	"System mailboxes are provisioned automatically":
		"system-mailboxes-auto-provisioned",
	"System mailboxes cannot be modified or deleted":
		"system-mailboxes-immutable",
	"Alias mailboxes cannot send mail": "alias-mailboxes-cannot-send",
	"aliasTargetId must reference a receiving mailbox":
		"alias-target-must-be-receiving",
	"Only shared mailboxes support grants": "only-shared-mailboxes-support-grants",
	"Only shared mailboxes support manager assignments":
		"only-shared-mailboxes-support-manager-assignments",
	"Manager assignments only apply to manager accounts":
		"manager-assignments-manager-only",
	"Shared mailbox access cannot be granted to the intendant":
		"shared-mailbox-access-not-for-intendant",
	"Invite codes can only be regenerated for pending accounts":
		"invite-codes-pending-only",
	"Intendant profile cannot be edited": "intendant-profile-cannot-be-edited",
	"Could not determine sender domain for this account":
		"could-not-determine-sender-domain",
	"defaultIdentityCustomName is required for custom pattern":
		"default-identity-custom-name-required",
	"Local part policy could not be applied from profile fields":
		"local-part-policy-could-not-be-applied",
	"At least one API key scope is required": "at-least-one-api-key-scope-required",
	"At least one of 'text' or 'html' is required": "text-or-html-required",
	"Field 'to' must be a non-empty array": "to-must-be-non-empty-array",
	"Field 'subject' is required": "subject-required",
	"Field 'attachments' must be an array": "attachments-must-be-array",
	"Field 'labelIds' must be an array": "label-ids-must-be-array",
	"Field 'query' is required": "query-required",
	"Field 'mailboxId' is required": "mailbox-id-required",
	"Field 'address' is required": "address-required",
	"Field 'domain' is required": "domain-id-required",
	"Field 'domainId' is required": "domain-id-required",
	"Field 'name' is required": "name-required",
	"Field 'type' is invalid": "type-invalid",
	"homescreenUrl must be a valid URL": "homescreen-url-invalid",
	"homescreenUrl must be http or https": "homescreen-url-scheme-invalid",
	"redirectUris must not be empty": "redirect-uris-not-empty",
	"Public clients do not have secrets": "public-clients-have-no-secrets",
	"importance must be an integer from 0 to 10": "importance-out-of-range",
	"Image is too large": "image-too-large",
	"Unsupported image type": "unsupported-image-type",
	"size must be small or large": "size-must-be-small-or-large",
	"Template file must be 1 MiB or smaller": "template-file-too-large",
	"That HTML file is empty": "html-file-empty",
	"Unknown system email template": "unknown-system-email-template",
	"System template not configured": "system-template-not-configured",
	"System template content not found": "system-template-content-not-found",
	"Template content not found": "template-content-not-found",
	"OIDC client logo not found": "oidc-client-logo-not-found",
	"Profile picture not found": "profile-picture-not-found",
	"Session not found": "session-not-found",
	"Raw message not found": "raw-message-not-found",
	"Parent message not found": "parent-message-not-found",
	"Validation run not found": "validation-run-not-found",
	"One or more labels not found": "one-or-more-labels-not-found",
	"Message-ID header is required": "message-id-header-required",
	"Parent message-id is required for reply threading":
		"parent-message-id-required-for-reply",
	"Message-ID conflict while storing draft": "message-id-conflict-draft",
	"Message-ID conflict while storing outbound message":
		"message-id-conflict-outbound",
	"Request body must be an object": "request-body-must-be-object",
	"inviteRole is required for assign_invite_role operation":
		"invite-role-required",
	"removeTarget is required for remove operation": "remove-target-required",
	"Invalid aliasTargetAddress": "invalid-alias-target-address",
	"Sent message not found": "message-not-found",
	"Existing sent message not found": "message-not-found",
	"Stored message not found": "message-not-found",
	"Stored sent message not found": "message-not-found",
	"Unknown thread action": "unknown-thread-action",
};

/** Pattern-based codes for details with dynamic segments. */
const DETAIL_PATTERNS: Array<{ pattern: RegExp; code: ApiErrorCode }> = [
	{
		pattern: /^API key scope '.+' is required$/,
		code: "api-key-scope-required",
	},
	{
		pattern: /^Query parameter '.+' is required$/,
		code: "missing-query-parameter",
	},
	{
		pattern: /^Field '.+' is required$/,
		code: "field-required",
	},
	{
		pattern: /^Field '.+' is invalid$/,
		code: "field-invalid",
	},
	{
		pattern: /^Field '.+' must be /,
		code: "validation-error",
	},
	{
		pattern: /^Unknown thread action:/,
		code: "unknown-thread-action",
	},
];

export function errorCodeFromDetail(detail: string): ApiErrorCode | undefined {
	const exact = DETAIL_TO_CODE[detail];
	if (exact) {
		return exact;
	}

	for (const { pattern, code } of DETAIL_PATTERNS) {
		if (pattern.test(detail)) {
			return code;
		}
	}

	return undefined;
}

export function resolveErrorCode(
	detail: string,
	fallback: ApiErrorCode = "bad-request",
): ApiErrorCode {
	return errorCodeFromDetail(detail) ?? fallback;
}
