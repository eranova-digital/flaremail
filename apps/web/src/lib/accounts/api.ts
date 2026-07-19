import { apiRequest } from "@/lib/api/request";
import type { AuthSession, MfaStatus } from "@/lib/auth/types";

import type { ProfilePicture } from "@/lib/profile-picture";

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
	primaryMailboxId: string | null;
	domainId: string | null;
	displayName: string;
	profilePicture: ProfilePicture | null;
};

export type AccountDetail = AccountSummary & {
	profile: AccountProfile | null;
	profilePicture: ProfilePicture | null;
	lockedFields: string[];
	domainIds: string[];
	allSharedMailboxes: boolean;
	sharedMailboxIds: string[];
	grantedMailboxIds: string[];
	invitedBy: {
		id: string;
		displayName: string;
		loginIdentifier: string;
		profilePicture: ProfilePicture | null;
		deleted: boolean;
	} | null;
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
	requireRecoveryEmail: boolean;
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

export async function fetchAccounts(): Promise<AccountSummary[]> {
	const data = await apiRequest<{ items: AccountSummary[] }>("/accounts");
	return data.items;
}

export async function fetchAccount(id: string): Promise<AccountDetail> {
	return apiRequest<AccountDetail>(`/accounts/${id}`);
}

export async function fetchInvitePreview(code: string): Promise<InvitePreview> {
	return apiRequest<InvitePreview>(
		`/auth/invite-preview?code=${encodeURIComponent(code.trim())}`,
	);
}

export async function inviteAccount(
	input: InviteAccountInput,
): Promise<{ inviteCode: string; address: string; accountId: string }> {
	return apiRequest("/accounts/invite", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export async function suggestInviteLocalPart(input: {
	domainId: string;
	firstName?: string;
	lastName?: string;
}): Promise<string | null> {
	const data = await apiRequest<{ localPart: string | null }>(
		"/accounts/invite/suggest-local-part",
		{
			method: "POST",
			body: JSON.stringify(input),
		},
	);
	return data.localPart;
}

export async function updateAccount(
	id: string,
	body: {
		profile?: Partial<AccountProfile>;
		lockedFields?: string[];
	},
): Promise<AccountDetail> {
	return apiRequest<AccountDetail>(`/accounts/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});
}

export async function updateAccountAssignments(
	id: string,
	body: {
		domainIds?: string[];
		allSharedMailboxes?: boolean;
		sharedMailboxIds?: string[];
		grantedMailboxIds?: string[];
	},
): Promise<AccountDetail> {
	return apiRequest<AccountDetail>(`/accounts/${id}/assignments`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});
}

export async function updateMyProfile(
	profile: Partial<AccountProfile>,
): Promise<AccountDetail> {
	return apiRequest<AccountDetail>("/auth/me", {
		method: "PATCH",
		body: JSON.stringify({ profile }),
	});
}

export async function assignAccountRole(input: {
	accountId: string;
	role: AccountRole;
	domainIds?: string[];
}): Promise<void> {
	await apiRequest("/accounts/assign-role", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export async function suspendAccount(id: string): Promise<void> {
	await apiRequest(`/accounts/${id}/suspend`, { method: "POST" });
}

export async function unsuspendAccount(id: string): Promise<void> {
	await apiRequest(`/accounts/${id}/unsuspend`, { method: "POST" });
}

export async function removeAccount(id: string): Promise<void> {
	await apiRequest(`/accounts/${id}`, { method: "DELETE" });
}

export async function createPasswordResetCode(id: string): Promise<string> {
	const data = await apiRequest<{ code: string }>(
		`/accounts/${id}/password-reset-code`,
		{ method: "POST" },
	);
	return data.code;
}

export async function regenerateInviteCode(id: string): Promise<string> {
	const data = await apiRequest<{ inviteCode: string }>(
		`/accounts/${id}/regenerate-invite`,
		{ method: "POST" },
	);
	return data.inviteCode;
}

export type MailboxGrantHolder = {
	accountId: string;
	loginIdentifier: string;
	displayName: string;
	profilePicture: ProfilePicture | null;
	role: AccountRole | null;
	status: string;
};

export async function fetchMailboxGrantHolders(
	mailboxId: string,
): Promise<MailboxGrantHolder[]> {
	const data = await apiRequest<{ items: MailboxGrantHolder[] }>(
		`/mailboxes/${mailboxId}/grants`,
	);
	return data.items;
}

export async function grantSharedMailboxAccess(input: {
	accountId: string;
	mailboxId: string;
}): Promise<void> {
	await apiRequest(`/accounts/${input.accountId}/mailbox-grants`, {
		method: "POST",
		body: JSON.stringify({ mailboxId: input.mailboxId }),
	});
}

export async function revokeSharedMailboxAccess(input: {
	accountId: string;
	mailboxId: string;
}): Promise<void> {
	await apiRequest(
		`/accounts/${input.accountId}/mailbox-grants/${input.mailboxId}`,
		{ method: "DELETE" },
	);
}

export type MailboxManagerAssignment = {
	accountId: string;
	loginIdentifier: string;
	displayName: string;
	profilePicture: ProfilePicture | null;
	role: AccountRole;
	status: string;
	viaAllShared: boolean;
};

export async function fetchMailboxManagerAssignments(
	mailboxId: string,
): Promise<MailboxManagerAssignment[]> {
	const data = await apiRequest<{ items: MailboxManagerAssignment[] }>(
		`/mailboxes/${mailboxId}/manager-assignments`,
	);
	return data.items;
}

export async function grantManagerMailboxAssignment(input: {
	accountId: string;
	mailboxId: string;
}): Promise<void> {
	await apiRequest(`/accounts/${input.accountId}/manager-assignments`, {
		method: "POST",
		body: JSON.stringify({ mailboxId: input.mailboxId }),
	});
}

export async function revokeManagerMailboxAssignment(input: {
	accountId: string;
	mailboxId: string;
}): Promise<void> {
	await apiRequest(
		`/accounts/${input.accountId}/manager-assignments/${input.mailboxId}`,
		{ method: "DELETE" },
	);
}

export async function fetchLocalPartPolicy(
	domainId: string,
): Promise<LocalPartPolicy> {
	return apiRequest<LocalPartPolicy>(`/domains/${domainId}/local-part-policy`);
}

export async function updateLocalPartPolicy(
	domainId: string,
	body: { enforced?: boolean; pattern?: string | null },
): Promise<LocalPartPolicy> {
	return apiRequest<LocalPartPolicy>(`/domains/${domainId}/local-part-policy`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});
}

export async function fetchAccountSessions(
	accountId: string,
): Promise<AuthSession[]> {
	const data = await apiRequest<{ items: AuthSession[] }>(
		`/accounts/${accountId}/sessions`,
	);
	return data.items;
}

export async function revokeAccountSession(
	accountId: string,
	sessionId: string,
): Promise<void> {
	await apiRequest(`/accounts/${accountId}/sessions/${sessionId}`, {
		method: "DELETE",
	});
}

export async function revokeAllAccountSessions(accountId: string): Promise<void> {
	await apiRequest(`/accounts/${accountId}/sessions`, { method: "DELETE" });
}

export async function fetchAccountMfaStatus(accountId: string): Promise<MfaStatus> {
	return apiRequest<MfaStatus>(`/accounts/${accountId}/mfa`);
}

export async function disableAccountMfa(accountId: string): Promise<MfaStatus> {
	return apiRequest<MfaStatus>(`/accounts/${accountId}/mfa`, {
		method: "DELETE",
	});
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
