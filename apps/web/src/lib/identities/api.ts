import { apiRequest } from "@/lib/api/request";
import type { IdentityNamePattern } from "./name-pattern";
import { IDENTITY_NAME_PATTERNS } from "./name-pattern";

export type Identity = {
	id: string;
	mailboxId: string | null;
	isDefault: boolean;
	namePattern: IdentityNamePattern;
	customName: string | null;
	signatureHtml: string | null;
	fromNamePreview: string;
	createdAt: string | null;
	updatedAt: string | null;
};

export type IdentityInput = {
	namePattern: IdentityNamePattern;
	customName?: string | null;
	signatureHtml?: string | null;
};

export const IDENTITY_NAME_PATTERN_OPTIONS: {
	value: IdentityNamePattern;
	label: string;
}[] = [
	{ value: "none", label: "No name (address only)" },
	{ value: "first_name", label: "First name" },
	{ value: "last_name", label: "Last name" },
	{ value: "first_name_last_name", label: "First name Last name" },
	{ value: "last_name_first_name", label: "Last name First name" },
	{ value: "first_initial_last_name", label: "F. Last name" },
	{ value: "last_name_first_initial", label: "Last name F." },
	{ value: "first_name_last_initial", label: "First name L." },
	{ value: "last_initial_first_name", label: "L. First name" },
	{ value: "custom", label: "Custom name" },
];

export function identityNamePatternLabel(pattern: IdentityNamePattern): string {
	return (
		IDENTITY_NAME_PATTERN_OPTIONS.find((option) => option.value === pattern)
			?.label ?? pattern
	);
}

export function isKnownIdentityNamePattern(
	value: string,
): value is IdentityNamePattern {
	return (IDENTITY_NAME_PATTERNS as readonly string[]).includes(value);
}

export async function listMailboxIdentities(
	mailboxId: string,
): Promise<{
	items: Identity[];
	capabilities: { canManage: boolean; customNameAllowed: boolean };
}> {
	return apiRequest(`/mailboxes/${mailboxId}/identities`);
}

export async function listAvailableIdentities(
	mailboxId: string,
): Promise<Identity[]> {
	const data = await apiRequest<{ items: Identity[] }>(
		`/mailboxes/${mailboxId}/identities/available`,
	);
	return data.items;
}

export async function createMailboxIdentity(
	mailboxId: string,
	input: IdentityInput,
): Promise<Identity> {
	return apiRequest<Identity>(`/mailboxes/${mailboxId}/identities`, {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export async function updateMailboxIdentity(
	mailboxId: string,
	identityId: string,
	input: Partial<IdentityInput>,
): Promise<Identity> {
	return apiRequest<Identity>(
		`/mailboxes/${mailboxId}/identities/${identityId}`,
		{
			method: "PATCH",
			body: JSON.stringify(input),
		},
	);
}

export async function deleteMailboxIdentity(
	mailboxId: string,
	identityId: string,
): Promise<void> {
	await apiRequest(`/mailboxes/${mailboxId}/identities/${identityId}`, {
		method: "DELETE",
	});
}

export async function updateMailboxIdentityPolicy(
	mailboxId: string,
	input: {
		personalIdentityAllowance?: boolean;
		identityExport?: boolean;
	},
): Promise<void> {
	await apiRequest(`/mailboxes/${mailboxId}`, {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}
