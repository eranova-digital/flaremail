import PostalMime from "postal-mime";

import type { EmailAddressInput } from "../addresses";
import { firstEmailAddress, formatEmailAddress } from "../addresses";
import { formatAddress, formatAddressList } from "../format-address";
import { normalizeEmailAddress } from "../normalize-email-address";

type ParsedParticipants = {
	from: string[];
	to: string[];
	cc: string[];
	replyTo: string[];
};

function parseAddressHeader(value: string | null | undefined): string[] {
	if (!value?.trim()) {
		return [];
	}

	return value
		.split(",")
		.map((part) => normalizeEmailAddress(part.replace(/.*<([^>]+)>.*/, "$1").trim()))
		.filter(Boolean);
}

function uniqueAddresses(addresses: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const address of addresses) {
		const normalized = normalizeEmailAddress(address);
		if (!normalized || seen.has(normalized)) {
			continue;
		}

		seen.add(normalized);
		result.push(normalized);
	}

	return result;
}

function excludeSelf(addresses: string[], selfAddress: string): string[] {
	const self = normalizeEmailAddress(selfAddress);
	return addresses.filter((address) => normalizeEmailAddress(address) !== self);
}

async function parseParticipantsFromEml(
	bucket: R2Bucket,
	rawEmlKey: string,
	fallback: { from: string; to: string; cc: string | null },
): Promise<ParsedParticipants> {
	const object = await bucket.get(rawEmlKey);
	if (!object) {
		return {
			from: parseAddressHeader(fallback.from),
			to: parseAddressHeader(fallback.to),
			cc: parseAddressHeader(fallback.cc),
			replyTo: [],
		};
	}

	const parsed = await PostalMime.parse(await object.arrayBuffer());
	const replyToHeader = parsed.headers?.find(
		(header) => header.key.toLowerCase() === "reply-to",
	)?.value;

	return {
		from: parseAddressHeader(formatAddress(parsed.from ?? undefined) ?? fallback.from),
		to: parseAddressHeader(formatAddressList(parsed.to) ?? fallback.to),
		cc: parseAddressHeader(formatAddressList(parsed.cc) ?? fallback.cc),
		replyTo: parseAddressHeader(replyToHeader ?? null),
	};
}

export async function resolveReplyRecipients(
	bucket: R2Bucket,
	parent: {
		rawEmlKey: string;
		from: string;
		to: string;
		cc: string | null;
	},
	sendingMailboxAddress: string,
	replyAll: boolean,
	overrides?: {
		to?: EmailAddressInput[];
		cc?: EmailAddressInput[];
		bcc?: EmailAddressInput[];
	},
): Promise<{
	to: EmailAddressInput[];
	cc?: EmailAddressInput[];
	bcc?: EmailAddressInput[];
}> {
	if (overrides?.to?.length) {
		return {
			to: overrides.to,
			cc: overrides.cc,
			bcc: overrides.bcc,
		};
	}

	const participants = await parseParticipantsFromEml(bucket, parent.rawEmlKey, {
		from: parent.from,
		to: parent.to,
		cc: parent.cc,
	});

	const self = normalizeEmailAddress(sendingMailboxAddress);
	const replyToOrFrom =
		participants.replyTo[0] ?? participants.from[0] ?? parent.from;

	// When replying to a message we sent ourselves, the sender is our own
	// mailbox. Replying to "from" would loop the message back to us — the
	// recipient ends up equal to the sender, and providers (including
	// Cloudflare's Email Service) can silently drop it. Reply to the original
	// recipients instead, mirroring how mail clients treat replying to your own
	// sent mail.
	const replyTarget =
		normalizeEmailAddress(replyToOrFrom) === self
			? (excludeSelf(
					uniqueAddresses([...participants.to, ...participants.cc]),
					sendingMailboxAddress,
				)[0] ?? replyToOrFrom)
			: replyToOrFrom;

	if (!replyAll) {
		return {
			to: [replyTarget],
			cc: overrides?.cc,
			bcc: overrides?.bcc,
		};
	}

	// Reply-all keeps the primary recipients of the message being replied to in
	// "To" (the original "To" audience), and moves everyone else — the sender,
	// Reply-To, and any Cc'd participants — into "Cc". This mirrors treating Cc
	// as "also part of the conversation" rather than promoting them to primary.
	const toAddresses = excludeSelf(
		uniqueAddresses(participants.to),
		sendingMailboxAddress,
	);
	const primaryTo = toAddresses.length ? toAddresses : [replyTarget];
	const primaryToSet = new Set(
		primaryTo.map((address) => normalizeEmailAddress(address)),
	);

	const ccAddresses = excludeSelf(
		uniqueAddresses([
			...participants.from,
			...participants.replyTo,
			...participants.cc,
		]),
		sendingMailboxAddress,
	).filter((address) => !primaryToSet.has(normalizeEmailAddress(address)));

	return {
		to: primaryTo.map((address) => formatEmailAddress(address)),
		cc: ccAddresses.length
			? ccAddresses.map((address) => formatEmailAddress(address))
			: overrides?.cc,
		bcc: overrides?.bcc,
	};
}

export function primaryRecipient(addresses: EmailAddressInput[]): string {
	return firstEmailAddress(addresses);
}
