import { apiRequest } from "@/lib/api/request";
import i18n from "@/lib/i18n";
import type { IdentityNamePattern } from "@test-worker/identity-name-pattern";
import { IDENTITY_NAME_PATTERNS } from "@test-worker/identity-name-pattern";

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

const IDENTITY_NAME_PATTERN_VALUES = [
	"none",
	"first_name",
	"last_name",
	"first_name_last_name",
	"last_name_first_name",
	"first_initial_last_name",
	"last_name_first_initial",
	"first_name_last_initial",
	"last_initial_first_name",
	"custom",
] as const satisfies readonly IdentityNamePattern[];

export function getIdentityNamePatternOptions(): {
	value: IdentityNamePattern;
	label: string;
}[] {
	return IDENTITY_NAME_PATTERN_VALUES.map((value) => ({
		value,
		label: identityNamePatternLabel(value),
	}));
}

/** Locale-aware options; prefer getIdentityNamePatternOptions() at call sites. */
export const IDENTITY_NAME_PATTERN_OPTIONS: {
	value: IdentityNamePattern;
	label: string;
}[] = IDENTITY_NAME_PATTERN_VALUES.map((value) => ({
	value,
	get label() {
		return identityNamePatternLabel(value);
	},
}));

export function identityNamePatternLabel(pattern: IdentityNamePattern): string {
	if (!isKnownIdentityNamePattern(pattern)) {
		return pattern;
	}
	return i18n.t(`identities.patterns.${pattern}`, { ns: "settings" });
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

export async function listAccountIdentitiesForAccount(
	accountId: string,
): Promise<AccountIdentitiesOverview> {
	return apiRequest<AccountIdentitiesOverview>(
		`/accounts/${accountId}/identities`,
	);
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
