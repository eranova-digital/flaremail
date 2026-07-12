import { AuthorizationDeniedError } from "../auth/authorize";
import { MailboxAccessDeniedError } from "../auth/mailbox-access";
import { AccountAccessDeniedError } from "../auth/account-access";
import { EmailSendError, emailSendErrorStatus } from "../messages/send-email";
import { NoRecoveryEmailError } from "../../services/auth";
import { problemResponse, problemTitle, requestInstance } from "./problem";

export function handleRouteError(error: unknown, request?: Request): Response {
	const instance = request ? requestInstance(request) : undefined;

	if (error instanceof AuthorizationDeniedError) {
		return problemResponse(403, error.message, {
			code: "forbidden",
			instance,
		});
	}

	if (error instanceof AccountAccessDeniedError) {
		return problemResponse(403, error.message, {
			code: "forbidden",
			instance,
		});
	}

	if (error instanceof MailboxAccessDeniedError) {
		return problemResponse(403, error.message, {
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
		return problemResponse(
			notFound ? 404 : 400,
			error.message,
			{
				code: notFound ? "not-found" : "bad-request",
				instance,
			},
		);
	}

	return problemResponse(500, "Internal server error", {
		code: "internal-error",
		instance,
	});
}
