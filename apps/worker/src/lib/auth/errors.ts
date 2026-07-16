export class NoRecoveryEmailError extends Error {
	constructor() {
		super(
			"You haven't configured a recovery email. Please ask a supervisor for a recovery code.",
		);
		this.name = "NoRecoveryEmailError";
	}
}
