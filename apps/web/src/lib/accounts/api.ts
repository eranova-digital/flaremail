import { apiUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";

export type AccountRole = "user" | "manager" | "admin" | "superadmin";

export type AccountProfile = {
	firstName: string;
	lastName: string;
	recoveryAddress: string | null;
	phone: string | null;
	address: {
		country: string | null;
		state: string | null;
		city: string | null;
		line1: string | null;
		line2: string | null;
	};
};

export type AccountSummary = {
	id: string;
	loginIdentifier: string;
	role: AccountRole | null;
	status: string;
	isIntendant: boolean;
	domainId: string | null;
	displayName: string;
};

export type AccountDetail = AccountSummary & {
	profile: AccountProfile | null;
	lockedFields: string[];
	domainIds: string[];
};

export type LocalPartPolicy = {
	domainId: string;
	enforced: boolean;
	pattern: string | null;
};

export type InviteAccountInput = {
	domainId: string;
	localPart: string;
	role?: AccountRole;
	firstName?: string;
	lastName?: string;
	recoveryAddress?: string;
	phone?: string;
	addressCountry?: string;
	addressState?: string;
	addressCity?: string;
	addressLine1?: string;
	addressLine2?: string;
	lockedFields?: string[];
	sendInviteEmail?: boolean;
	assignedDomainIds?: string[];
	sharedMailboxIds?: string[];
	allSharedMailboxes?: boolean;
};

export type InvitePreview = {
	address: string;
	lockedFields: string[];
	profile: {
		firstName: string;
		lastName: string;
		recoveryAddress: string | null;
		phone: string | null;
		address: {
			country: string | null;
			state: string | null;
			city: string | null;
			line1: string | null;
			line2: string | null;
		};
	} | null;
};

async function parseJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(getErrorMessage(body) ?? "Request failed");
	}
	return response.json() as Promise<T>;
}

export async function fetchAccounts(): Promise<AccountSummary[]> {
	const response = await fetch(apiUrl("/accounts"), { credentials: "include" });
	const data = await parseJson<{ items: AccountSummary[] }>(response);
	return data.items;
}

export async function fetchAccount(id: string): Promise<AccountDetail> {
	const response = await fetch(apiUrl(`/accounts/${id}`), {
		credentials: "include",
	});
	return parseJson<AccountDetail>(response);
}

export async function fetchInvitePreview(code: string): Promise<InvitePreview> {
	const response = await fetch(
		apiUrl(`/auth/invite-preview?code=${encodeURIComponent(code.trim())}`),
		{ credentials: "include" },
	);
	return parseJson<InvitePreview>(response);
}

export async function inviteAccount(
	input: InviteAccountInput,
): Promise<{ inviteCode: string; address: string; accountId: string }> {
	const response = await fetch(apiUrl("/accounts/invite"), {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	return parseJson(response);
}

export async function suggestInviteLocalPart(input: {
	domainId: string;
	firstName?: string;
	lastName?: string;
}): Promise<string | null> {
	const response = await fetch(apiUrl("/accounts/invite/suggest-local-part"), {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const data = await parseJson<{ localPart: string | null }>(response);
	return data.localPart;
}

export async function updateAccount(
	id: string,
	body: { profile?: Partial<AccountProfile>; lockedFields?: string[] },
): Promise<AccountDetail> {
	const response = await fetch(apiUrl(`/accounts/${id}`), {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return parseJson<AccountDetail>(response);
}

export async function updateMyProfile(
	profile: Partial<AccountProfile>,
): Promise<AccountDetail> {
	const response = await fetch(apiUrl("/auth/me"), {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ profile }),
	});
	return parseJson<AccountDetail>(response);
}

export async function assignAccountRole(input: {
	accountId: string;
	role: AccountRole;
	domainIds?: string[];
}): Promise<void> {
	const response = await fetch(apiUrl("/accounts/assign-role"), {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	await parseJson(response);
}

export async function suspendAccount(id: string): Promise<void> {
	const response = await fetch(apiUrl(`/accounts/${id}/suspend`), {
		method: "POST",
		credentials: "include",
	});
	await parseJson(response);
}

export async function unsuspendAccount(id: string): Promise<void> {
	const response = await fetch(apiUrl(`/accounts/${id}/unsuspend`), {
		method: "POST",
		credentials: "include",
	});
	await parseJson(response);
}

export async function removeAccount(id: string): Promise<void> {
	const response = await fetch(apiUrl(`/accounts/${id}`), {
		method: "DELETE",
		credentials: "include",
	});
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(getErrorMessage(body) ?? "Remove failed");
	}
}

export async function createPasswordResetCode(id: string): Promise<string> {
	const response = await fetch(apiUrl(`/accounts/${id}/password-reset-code`), {
		method: "POST",
		credentials: "include",
	});
	const data = await parseJson<{ code: string }>(response);
	return data.code;
}

export async function regenerateInviteCode(id: string): Promise<string> {
	const response = await fetch(apiUrl(`/accounts/${id}/regenerate-invite`), {
		method: "POST",
		credentials: "include",
	});
	const data = await parseJson<{ inviteCode: string }>(response);
	return data.inviteCode;
}

export type MailboxGrantHolder = {
	accountId: string;
	loginIdentifier: string;
	displayName: string;
	role: AccountRole | null;
	status: string;
};

export async function fetchMailboxGrantHolders(
	mailboxId: string,
): Promise<MailboxGrantHolder[]> {
	const response = await fetch(apiUrl(`/mailboxes/${mailboxId}/grants`), {
		credentials: "include",
	});
	const data = await parseJson<{ items: MailboxGrantHolder[] }>(response);
	return data.items;
}

export async function grantSharedMailboxAccess(input: {
	accountId: string;
	mailboxId: string;
}): Promise<void> {
	const response = await fetch(
		apiUrl(`/accounts/${input.accountId}/mailbox-grants`),
		{
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mailboxId: input.mailboxId }),
		},
	);
	await parseJson(response);
}

export async function revokeSharedMailboxAccess(input: {
	accountId: string;
	mailboxId: string;
}): Promise<void> {
	const response = await fetch(
		apiUrl(`/accounts/${input.accountId}/mailbox-grants/${input.mailboxId}`),
		{
			method: "DELETE",
			credentials: "include",
		},
	);
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(getErrorMessage(body) ?? "Revoke failed");
	}
}

export async function fetchLocalPartPolicy(
	domainId: string,
): Promise<LocalPartPolicy> {
	const response = await fetch(apiUrl(`/domains/${domainId}/local-part-policy`), {
		credentials: "include",
	});
	return parseJson<LocalPartPolicy>(response);
}

export async function updateLocalPartPolicy(
	domainId: string,
	body: { enforced?: boolean; pattern?: string | null },
): Promise<LocalPartPolicy> {
	const response = await fetch(apiUrl(`/domains/${domainId}/local-part-policy`), {
		method: "PATCH",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return parseJson<LocalPartPolicy>(response);
}

export const PROFILE_FIELDS = [
	{ key: "firstName", label: "First name" },
	{ key: "lastName", label: "Last name" },
	{ key: "recoveryAddress", label: "Recovery address" },
	{ key: "phone", label: "Phone" },
	{ key: "addressCountry", label: "Country" },
	{ key: "addressState", label: "State" },
	{ key: "addressCity", label: "City" },
	{ key: "addressLine1", label: "Address line 1" },
	{ key: "addressLine2", label: "Address line 2" },
] as const;
