import type { Mailbox } from "@/lib/api/client";

export const MAILBOX_TYPE_DISPLAY_ORDER = [
	"primary",
	"secondary",
	"shared",
	"alias",
	"system",
] as const satisfies readonly NonNullable<Mailbox["type"]>[];

const MAILBOX_TYPE_ORDER: Record<NonNullable<Mailbox["type"]>, number> = {
	primary: 0,
	secondary: 1,
	shared: 2,
	alias: 3,
	system: 4,
};

export type MailboxTypeGroup = {
	type: NonNullable<Mailbox["type"]>;
	mailboxes: Mailbox[];
};

export function getMailboxDisplayType(
	mailbox: Mailbox,
): NonNullable<Mailbox["type"]> | undefined {
	if (mailbox.isSystemManaged) {
		return "system";
	}

	return mailbox.type ?? undefined;
}

function getMailboxTypeOrder(type?: Mailbox["type"]): number {
	if (!type) {
		return Number.MAX_SAFE_INTEGER;
	}

	return MAILBOX_TYPE_ORDER[type] ?? Number.MAX_SAFE_INTEGER;
}

export function compareMailboxesByTypeThenAddress(
	left: Mailbox,
	right: Mailbox,
): number {
	const typeOrder =
		getMailboxTypeOrder(getMailboxDisplayType(left)) -
		getMailboxTypeOrder(getMailboxDisplayType(right));
	if (typeOrder !== 0) {
		return typeOrder;
	}

	return (left.address ?? "").localeCompare(right.address ?? "");
}

export type MailboxDomainGroup = {
	domainId?: string;
	domainName: string;
	typeGroups: MailboxTypeGroup[];
	mailboxes: Mailbox[];
};

function compareMailboxesByAddress(left: Mailbox, right: Mailbox): number {
	return (left.address ?? "").localeCompare(right.address ?? "");
}

export function groupMailboxesByType(mailboxes: Mailbox[]): MailboxTypeGroup[] {
	const groups = new Map<NonNullable<Mailbox["type"]>, Mailbox[]>();

	for (const mailbox of mailboxes) {
		const displayType = getMailboxDisplayType(mailbox);
		if (!displayType) {
			continue;
		}

		const items = groups.get(displayType) ?? [];
		items.push(mailbox);
		groups.set(displayType, items);
	}

	return MAILBOX_TYPE_DISPLAY_ORDER.flatMap((type) => {
		const items = groups.get(type);
		if (!items?.length) {
			return [];
		}

		return [
			{
				type,
				mailboxes: [...items].sort(compareMailboxesByAddress),
			},
		];
	});
}

export function groupMailboxesByDomain(
	mailboxes: Mailbox[],
	domainNamesById: Map<string, string>,
): MailboxDomainGroup[] {
	const groups = new Map<string, Omit<MailboxDomainGroup, "typeGroups">>();

	for (const mailbox of mailboxes) {
		const domainName =
			(mailbox.domainId && domainNamesById.get(mailbox.domainId)) ||
			"Unknown domain";
		const key = mailbox.domainId ?? domainName;
		const group = groups.get(key);

		if (group) {
			group.mailboxes.push(mailbox);
			continue;
		}

		groups.set(key, {
			domainId: mailbox.domainId,
			domainName,
			mailboxes: [mailbox],
		});
	}

	return [...groups.values()]
		.sort((left, right) => left.domainName.localeCompare(right.domainName))
		.map((group) => {
			const typeGroups = groupMailboxesByType(group.mailboxes);

			return {
				...group,
				typeGroups,
				mailboxes: typeGroups.flatMap((typeGroup) => typeGroup.mailboxes),
			};
		});
}

export function sortMailboxes(
	mailboxes: Mailbox[],
	domainNamesById: Map<string, string>,
): Mailbox[] {
	if (new Set(mailboxes.map((mailbox) => mailbox.domainId).filter(Boolean)).size > 1) {
		return groupMailboxesByDomain(mailboxes, domainNamesById).flatMap(
			(group) => group.mailboxes,
		);
	}

	return [...mailboxes].sort(compareMailboxesByTypeThenAddress);
}
