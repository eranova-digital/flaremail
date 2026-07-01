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
