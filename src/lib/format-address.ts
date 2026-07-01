import type { Address } from "postal-mime";

export function formatAddress(address: Address | undefined): string | null {
	if (!address) {
		return null;
	}

	if ("group" in address && Array.isArray(address.group)) {
		return address.group
			.map((member) => member.address ?? member.name ?? "")
			.filter(Boolean)
			.join(", ");
	}

	const mailbox = address as { address?: string; name?: string };
	return mailbox.address ?? mailbox.name ?? null;
}

export function formatAddressList(addresses: Address[] | undefined): string | null {
	if (!addresses?.length) {
		return null;
	}

	return addresses
		.map((address) => formatAddress(address))
		.filter(Boolean)
		.join(", ");
}
