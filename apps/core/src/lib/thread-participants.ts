import { extractEmailsFromHeaderValue } from "./extract-emails-from-header";
import { normalizeEmailAddress } from "./normalize-email-address";

export type ThreadPartyMessage = {
	from: string;
	to: string;
	cc: string | null;
	receivedAt: Date;
};

export type ThreadParties = {
	sender: string | null;
	participants: string[];
};

export function collectThreadParties(
	messageRows: ThreadPartyMessage[],
	mailboxAddress: string,
): ThreadParties {
	const normalizedSelf = normalizeEmailAddress(mailboxAddress);
	const participants = new Set<string>();
	let sender: string | null = null;
	let latestAt: Date | null = null;

	for (const message of messageRows) {
		if (!latestAt || message.receivedAt > latestAt) {
			latestAt = message.receivedAt;
			sender = message.from;
		}

		for (const email of [
			...extractEmailsFromHeaderValue(message.from),
			...extractEmailsFromHeaderValue(message.to),
			...extractEmailsFromHeaderValue(message.cc),
		]) {
			if (email !== normalizedSelf) {
				participants.add(email);
			}
		}
	}

	return {
		sender,
		participants: [...participants].sort(),
	};
}
