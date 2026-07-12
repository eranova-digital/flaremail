export function isUniqueViolation(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const code =
		"code" in error && typeof error.code === "string" ? error.code : null;
	if (code === "23505") {
		return true;
	}

	const message =
		"message" in error && typeof error.message === "string"
			? error.message
			: "";
	return message.includes("messages_message_id_unique");
}

function getPostgresErrorCode(error: unknown): string | null {
	if (!error || typeof error !== "object") {
		return null;
	}
	if ("code" in error && typeof error.code === "string") {
		return error.code;
	}
	if ("cause" in error) {
		return getPostgresErrorCode(error.cause);
	}
	return null;
}

function getPostgresErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") {
		return "";
	}
	if ("message" in error && typeof error.message === "string") {
		return error.message;
	}
	if ("cause" in error) {
		return getPostgresErrorMessage(error.cause);
	}
	return "";
}

export function isSchemaMismatchError(error: unknown): boolean {
	const code = getPostgresErrorCode(error);
	const message = getPostgresErrorMessage(error);
	return (
		code === "22P02" ||
		/invalid input value for enum/i.test(message) ||
		/relation .* does not exist/i.test(message)
	);
}

export function schemaMismatchMessage(): string {
	return "Database schema is out of date. Run npm run db:migrate from the repo root.";
}
