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

export type IdentityListResult = {
	items: Identity[];
	capabilities: { canManage: boolean; customNameAllowed: boolean };
};

export type SharedMailboxIdentitiesGroup = {
	mailboxId: string;
	mailboxAddress: string;
	identityExport: boolean;
	identities: Identity[];
};

export type AccountIdentitiesOverview = {
	own: Identity[];
	default: Identity | null;
	shared: SharedMailboxIdentitiesGroup[];
	capabilities: {
		canManageOwn: boolean;
		customNameAllowed: boolean;
		primaryMailboxId: string | null;
	};
};

function normalizeIdentityList(data: unknown): IdentityListResult {
	const root =
		data && typeof data === "object" ? (data as Record<string, unknown>) : {};

	// Correct shape: { items: Identity[], capabilities }
	// Legacy bug: { items: { items, capabilities } }
	const nested =
		root.items &&
		typeof root.items === "object" &&
		!Array.isArray(root.items)
			? (root.items as Record<string, unknown>)
			: null;

	const itemsSource = nested ?? root;
	const items = Array.isArray(itemsSource.items)
		? (itemsSource.items as Identity[])
		: Array.isArray(root.items)
			? (root.items as Identity[])
			: [];

	const capabilitiesSource =
		(itemsSource.capabilities as Record<string, unknown> | undefined) ??
		(root.capabilities as Record<string, unknown> | undefined) ??
		{};

	return {
		items,
		capabilities: {
			canManage: Boolean(capabilitiesSource.canManage),
			customNameAllowed: Boolean(capabilitiesSource.customNameAllowed),
		},
	};
}

export async function listMailboxIdentities(
	mailboxId: string,
): Promise<IdentityListResult> {
	const data = await apiRequest<unknown>(`/mailboxes/${mailboxId}/identities`);
	return normalizeIdentityList(data);
}

export async function listAccountIdentities(): Promise<AccountIdentitiesOverview> {
	return apiRequest<AccountIdentitiesOverview>("/identities");
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
