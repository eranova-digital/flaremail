import type { Email } from "postal-mime";

import type { Database } from "../../db/client";
import { extractValidationToken } from "./validation-body";
import {
	findCheckingRunByToken,
	findRunByToken,
	logStaleValidationEmail,
	markValidationReceived,
} from "./run-engine";

export async function tryConsumeValidationInbound(
	db: Database,
	message: ForwardableEmailMessage,
	parsed: Email,
): Promise<boolean> {
	const token = extractValidationToken(parsed.text, message.headers);
	if (!token) {
		return false;
	}

	const activeRun = await findCheckingRunByToken(db, token);
	if (activeRun) {
		await markValidationReceived(db, activeRun.id);
		return true;
	}

	const completedRun = await findRunByToken(db, token);
	if (completedRun) {
		await logStaleValidationEmail(db, completedRun.id);
		return true;
	}

	return false;
}
