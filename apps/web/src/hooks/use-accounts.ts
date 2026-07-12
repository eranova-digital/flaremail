import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	assignAccountRole,
	createPasswordResetCode,
	fetchAccount,
	fetchAccounts,
	fetchLocalPartPolicy,
	fetchMailboxGrantHolders,
	fetchMailboxManagerAssignments,
	grantSharedMailboxAccess,
	grantManagerMailboxAssignment,
	inviteAccount,
	regenerateInviteCode,
	removeAccount,
	revokeSharedMailboxAccess,
	revokeManagerMailboxAssignment,
	suggestInviteLocalPart,
	suspendAccount,
	unsuspendAccount,
	updateAccount,
	updateAccountAssignments,
	updateLocalPartPolicy,
	type InviteAccountInput,
} from "@/lib/accounts/api";

export const accountQueryKeys = {
	all: ["accounts"] as const,
	detail: (id: string) => ["accounts", id] as const,
	localPartPolicy: (domainId: string) =>
		["domains", domainId, "local-part-policy"] as const,
	mailboxGrants: (mailboxId: string) =>
		["mailboxes", mailboxId, "grants"] as const,
	mailboxManagers: (mailboxId: string) =>
		["mailboxes", mailboxId, "manager-assignments"] as const,
};

export function useAccounts() {
	return useQuery({
		queryKey: accountQueryKeys.all,
		queryFn: fetchAccounts,
	});
}

export function useAccount(id: string | null) {
	return useQuery({
		queryKey: id ? accountQueryKeys.detail(id) : ["accounts", "none"],
		queryFn: () => fetchAccount(id!),
		enabled: !!id,
	});
}

export function useLocalPartPolicy(domainId: string | null) {
	return useQuery({
		queryKey: domainId
			? accountQueryKeys.localPartPolicy(domainId)
			: ["local-part-policy", "none"],
		queryFn: () => fetchLocalPartPolicy(domainId!),
		enabled: !!domainId,
	});
}

export function useInviteAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: InviteAccountInput) => inviteAccount(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
		},
	});
}

export function useSuggestInviteLocalPart() {
	return useMutation({
		mutationFn: suggestInviteLocalPart,
	});
}

export function useUpdateAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: Parameters<typeof updateAccount>[1];
		}) => updateAccount(id, body),
		onSuccess: (data) => {
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
			void queryClient.invalidateQueries({
				queryKey: accountQueryKeys.detail(data.id),
			});
		},
	});
}

export function useUpdateAccountAssignments() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: Parameters<typeof updateAccountAssignments>[1];
		}) => updateAccountAssignments(id, body),
		onSuccess: (data) => {
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
			void queryClient.invalidateQueries({
				queryKey: accountQueryKeys.detail(data.id),
			});
		},
	});
}

export function useAssignAccountRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: assignAccountRole,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
		},
	});
}

export function useSuspendAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: suspendAccount,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
		},
	});
}

export function useUnsuspendAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: unsuspendAccount,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
		},
	});
}

export function useRemoveAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: removeAccount,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
		},
	});
}

export function useCreatePasswordResetCode() {
	return useMutation({
		mutationFn: createPasswordResetCode,
	});
}

export function useRegenerateInviteCode() {
	return useMutation({
		mutationFn: regenerateInviteCode,
	});
}

export function useMailboxGrantHolders(mailboxId: string | null) {
	return useQuery({
		queryKey: mailboxId
			? accountQueryKeys.mailboxGrants(mailboxId)
			: ["mailbox-grants", "none"],
		queryFn: () => fetchMailboxGrantHolders(mailboxId!),
		enabled: !!mailboxId,
	});
}

export function useGrantSharedMailboxAccess() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: grantSharedMailboxAccess,
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: accountQueryKeys.mailboxGrants(variables.mailboxId),
			});
		},
	});
}

export function useRevokeSharedMailboxAccess() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: revokeSharedMailboxAccess,
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: accountQueryKeys.mailboxGrants(variables.mailboxId),
			});
		},
	});
}

export function useMailboxManagerAssignments(mailboxId: string | null) {
	return useQuery({
		queryKey: mailboxId
			? accountQueryKeys.mailboxManagers(mailboxId)
			: ["mailbox-managers", "none"],
		queryFn: () => fetchMailboxManagerAssignments(mailboxId!),
		enabled: !!mailboxId,
	});
}

export function useGrantManagerMailboxAssignment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: grantManagerMailboxAssignment,
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: accountQueryKeys.mailboxManagers(variables.mailboxId),
			});
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
		},
	});
}

export function useRevokeManagerMailboxAssignment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: revokeManagerMailboxAssignment,
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: accountQueryKeys.mailboxManagers(variables.mailboxId),
			});
			void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
		},
	});
}

export function useUpdateLocalPartPolicy() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			domainId,
			body,
		}: {
			domainId: string;
			body: Parameters<typeof updateLocalPartPolicy>[1];
		}) => updateLocalPartPolicy(domainId, body),
		onSuccess: (data) => {
			void queryClient.invalidateQueries({
				queryKey: accountQueryKeys.localPartPolicy(data.domainId),
			});
		},
	});
}
