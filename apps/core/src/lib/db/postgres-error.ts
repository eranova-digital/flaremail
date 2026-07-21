export function isUniqueViolation(error: unknown): boolean {
	if (getPostgresErrorCode(error) === "23505") {
		return true;
	}

	const message = getPostgresErrorMessage(error);
	return (
		message.includes("messages_message_id_unique") ||
		/duplicate key value violates unique constraint/i.test(message)
	);
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
		const nested =
			"cause" in error ? getPostgresErrorMessage(error.cause) : "";
		return nested ? `${error.message}\n${nested}` : error.message;
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
