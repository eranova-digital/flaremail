import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createMailboxIdentity,
	deleteMailboxIdentity,
	listAvailableIdentities,
	listMailboxIdentities,
	updateMailboxIdentity,
	updateMailboxIdentityPolicy,
	type IdentityInput,
} from "@/lib/identities/api";

export const identityQueryKeys = {
	mailbox: (mailboxId: string) => ["identities", mailboxId] as const,
	available: (mailboxId: string) =>
		["identities", mailboxId, "available"] as const,
};

export function useMailboxIdentities(mailboxId: string | null | undefined) {
	return useQuery({
		queryKey: identityQueryKeys.mailbox(mailboxId ?? ""),
		queryFn: () => listMailboxIdentities(mailboxId!),
		enabled: Boolean(mailboxId),
	});
}

export function useAvailableIdentities(mailboxId: string | null | undefined) {
	return useQuery({
		queryKey: identityQueryKeys.available(mailboxId ?? ""),
		queryFn: () => listAvailableIdentities(mailboxId!),
		enabled: Boolean(mailboxId),
	});
}

export function useCreateMailboxIdentity(mailboxId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: IdentityInput) =>
			createMailboxIdentity(mailboxId, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: identityQueryKeys.mailbox(mailboxId),
			});
			void queryClient.invalidateQueries({
				queryKey: identityQueryKeys.available(mailboxId),
			});
		},
	});
}

export function useUpdateMailboxIdentity(mailboxId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			identityId,
			input,
		}: {
			identityId: string;
			input: Partial<IdentityInput>;
		}) => updateMailboxIdentity(mailboxId, identityId, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: identityQueryKeys.mailbox(mailboxId),
			});
			void queryClient.invalidateQueries({
				queryKey: identityQueryKeys.available(mailboxId),
			});
		},
	});
}

export function useDeleteMailboxIdentity(mailboxId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (identityId: string) =>
			deleteMailboxIdentity(mailboxId, identityId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: identityQueryKeys.mailbox(mailboxId),
			});
			void queryClient.invalidateQueries({
				queryKey: identityQueryKeys.available(mailboxId),
			});
		},
	});
}

export function useUpdateMailboxIdentityPolicy(mailboxId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			personalIdentityAllowance?: boolean;
			identityExport?: boolean;
		}) => updateMailboxIdentityPolicy(mailboxId, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
		},
	});
}
