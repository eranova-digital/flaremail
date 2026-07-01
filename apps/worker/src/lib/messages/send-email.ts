import type { EmailSendBuilderPayload } from "./build-outbound-mime";

export class EmailSendError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "EmailSendError";
		this.code = code;
	}
}

export async function sendEmail(
	email: SendEmail,
	payload: EmailSendBuilderPayload,
): Promise<EmailSendResult> {
	try {
		return await email.send(payload);
	} catch (error) {
		const code =
			error instanceof Error && "code" in error && typeof error.code === "string"
				? error.code
				: "E_INTERNAL_SERVER_ERROR";
		const message = error instanceof Error ? error.message : "Email send failed";
		throw new EmailSendError(code, message);
	}
}

export function emailSendErrorStatus(code: string): number {
	switch (code) {
		case "E_VALIDATION_ERROR":
		case "E_FIELD_MISSING":
		case "E_SENDER_NOT_VERIFIED":
		case "E_RECIPIENT_NOT_ALLOWED":
		case "E_HEADER_NOT_ALLOWED":
		case "E_HEADER_USE_API_FIELD":
		case "E_HEADER_VALUE_INVALID":
		case "E_HEADER_NAME_INVALID":
			return 400;
		case "E_RATE_LIMIT_EXCEEDED":
		case "E_DAILY_LIMIT_EXCEEDED":
			return 429;
		case "E_CONTENT_TOO_LARGE":
		case "E_TOO_MANY_RECIPIENTS":
		case "E_TOO_MANY_ATTACHMENTS":
		case "E_HEADERS_TOO_LARGE":
		case "E_HEADERS_TOO_MANY":
		case "E_HEADER_VALUE_TOO_LONG":
			return 413;
		default:
			return 500;
	}
}
