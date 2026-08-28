import { resolveErrorCode, errorCodeFromDetail } from "@flaremail/api-errors";
import { AuthorizationDeniedError } from "../auth/actions";
import {
	AccountAccessDeniedError,
	MailboxAccessDeniedError,
} from "../auth/access";
import { NoRecoveryEmailError } from "../auth/errors";
import { EmailSendError, emailSendErrorStatus } from "../messages/send-email";
import { problemResponse, problemTitle, requestInstance } from "./problem";

/**
 * Known Error.message values that are safe to return to clients as English
 * `detail` (for non-UI API consumers). UI clients should translate via `code`.
 * Messages registered in `@flaremail/api-errors` DETAIL_EXACT are also returned
 * even if omitted here (see handleRouteError).
 */
const SAFE_CLIENT_MESSAGES = new Set([
	"Invalid credentials",
	"Invalid or expired invite code",
	"Invite is no longer valid",
	"Invalid or expired reset code",
	"Authentication required",
	"Method not allowed",
	"Thread has no messages to reply to",
	"WebAuthn origin is not allowed",
	"Invalid MFA challenge",
	"Invalid passkey challenge",
	"Challenge already used",
	"Invalid authentication code",
	"Authenticator code is required",
	"Two-factor authentication is not enabled",
	"Two-factor authentication is not enabled for this account",
	"Only the intendant can regenerate this password",
	"Cannot modify your own assignments",
	"Only admins can change manager domain or shared-mailbox scope",
	"Catch-all mailbox must be an active receiving mailbox on this domain",
	"Validation run not found",
	"Validation run is not in progress",
	"Domain already exists",
	"Domain not found",
	"Account not found",
	"Attachment not found",
	"Attachment content not found",
	"Image not found",
	"BIMI logo not found",
	"size must be small or large",
	"Message not found",
	"Invalid email address",
	"Invalid recovery email address",
	"Recovery email cannot use a mailbox domain hosted by this instance",
	"Recovery email cannot use a mailbox hosted by this instance",
	"This recovery email is already in use by another account",
	"Phone number must be a valid international number in E.164 format (e.g. +14155552671)",
	"Password must be at least 8 characters and include a letter and a number",
	"Mailbox address is required",
	"Passkey id is required",
	"password is required",
	"email and password are required",
	"code and password are required",
	"code is required",
	"address is required",
	"mfaToken and code are required",
	"challengeToken and response are required",
	"code query parameter is required",
	"Unsupported grant_type",
	"Cannot suspend intendant",
	"The intendant account cannot be managed",
	"Cannot update intendant assignments",
	"Assignments only apply to admin or manager accounts",
	"Forbidden domain assignment",
	"Forbidden shared mailbox assignment",
	"Invalid shared mailbox assignment",
	"Mailbox grants cannot apply to the intendant account",
	"Mailbox already exists",
	"Forbidden",
	"Invalid Content-Length",
	"Request body is too large",
	"Request body must be valid JSON",
	"Rate limit exceeded",
]);

function clientSafeDetail(
	error: Error,
	notFound: boolean,
	mappedCode: string | undefined,
): string {
	if (SAFE_CLIENT_MESSAGES.has(error.message) || mappedCode) {
		return error.message;
	}
	if (notFound) {
		return "The requested resource was not found";
	}
	return "Bad request";
}

export function handleRouteError(error: unknown, request?: Request): Response {
	const instance = request ? requestInstance(request) : undefined;

	if (error instanceof AuthorizationDeniedError) {
		return problemResponse(403, "Forbidden", {
			code: "forbidden",
			instance,
		});
	}

	if (error instanceof AccountAccessDeniedError) {
		return problemResponse(403, "Forbidden", {
			code: "forbidden",
			instance,
		});
	}

	if (error instanceof MailboxAccessDeniedError) {
		return problemResponse(403, "Forbidden", {
			code: "forbidden",
			instance,
		});
	}

	if (error instanceof NoRecoveryEmailError) {
		return problemResponse(422, error.message, {
			code: "no-recovery-email",
			instance,
		});
	}

	if (error instanceof EmailSendError) {
		const status = emailSendErrorStatus(error.code);
		return problemResponse(status, error.message, {
			code: error.code.replace(/^E_/, "").replace(/_/g, "-").toLowerCase(),
			instance,
			title: problemTitle(status),
		});
	}

	if (error instanceof Error) {
		const notFound =
			/not found/i.test(error.message) ||
			error.message === "Thread has no messages to reply to";
		const mappedCode = errorCodeFromDetail(error.message);
		const detail = clientSafeDetail(error, notFound, mappedCode);
		if (detail === "Bad request") {
			console.error("Unmapped client error", error.message, error.cause ?? "");
		}
		return problemResponse(notFound ? 404 : 400, detail, {
			code:
				mappedCode ??
				resolveErrorCode(detail, notFound ? "not-found" : "bad-request"),
			instance,
		});
	}

	return problemResponse(500, "Internal server error", {
		code: "internal-error",
		instance,
	});
}
