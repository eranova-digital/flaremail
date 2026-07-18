import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createMailboxIdentity,
	deleteMailboxIdentity,
	listAccountIdentities,
	listAvailableIdentities,
	listMailboxIdentities,
	updateMailboxIdentity,
	updateMailboxIdentityPolicy,
	type IdentityInput,
} from "@/lib/identities/api";
import { queryKeys } from "@/lib/query-keys";

export const identityQueryKeys = {
	account: ["identities", "account"] as const,
	mailbox: (mailboxId: string) => ["identities", mailboxId] as const,
	available: (mailboxId: string) =>
		["identities", mailboxId, "available"] as const,
};

function invalidateIdentityQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	mailboxId: string,
) {
	void queryClient.invalidateQueries({
		queryKey: identityQueryKeys.mailbox(mailboxId),
	});
	void queryClient.invalidateQueries({
		queryKey: identityQueryKeys.available(mailboxId),
	});
	void queryClient.invalidateQueries({
		queryKey: identityQueryKeys.account,
	});
}

export function useAccountIdentities() {
	return useQuery({
		queryKey: identityQueryKeys.account,
		queryFn: () => listAccountIdentities(),
	});
}

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
			invalidateIdentityQueries(queryClient, mailboxId);
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
			invalidateIdentityQueries(queryClient, mailboxId);
		},
	});
}

export function useDeleteMailboxIdentity(mailboxId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (identityId: string) =>
			deleteMailboxIdentity(mailboxId, identityId),
		onSuccess: () => {
			invalidateIdentityQueries(queryClient, mailboxId);
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
			void queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes });
			invalidateIdentityQueries(queryClient, mailboxId);
		},
	});
}
