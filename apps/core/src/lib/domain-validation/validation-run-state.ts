export type ValidationRunPhase =
	| "dns"
	| "send"
	| "await_receive"
	| "completed";

export type ValidationRunEvent =
	| "mx_failed"
	| "send_failed"
	| "send_ok"
	| "received"
	| "timeout";

export function advanceValidationRunPhase(
	current: ValidationRunPhase,
	event: ValidationRunEvent,
): ValidationRunPhase {
	if (current === "completed") {
		return "completed";
	}

	switch (event) {
		case "mx_failed":
		case "send_failed":
			return "completed";
		case "send_ok":
			return "await_receive";
		case "received":
		case "timeout":
			return current === "await_receive" ? "completed" : current;
		default:
			return current;
	}
}
