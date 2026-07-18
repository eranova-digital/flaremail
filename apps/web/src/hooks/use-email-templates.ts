import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createEmailTemplate,
	deleteEmailTemplate,
	deleteSystemEmailTemplate,
	listComposeTemplates,
	listManageableTemplates,
	listSystemEmailTemplates,
	renameEmailTemplate,
	uploadSystemEmailTemplate,
	type SystemEmailTemplateKey,
} from "@/lib/email-templates/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { queryKeys } from "@/lib/query-keys";

export function useComposeTemplates(mailboxId: string) {
	const { account } = useAuth();

	return useQuery({
		queryKey: queryKeys.composeTemplates(mailboxId),
		queryFn: () => listComposeTemplates(mailboxId),
		enabled: Boolean(account && mailboxId),
	});
}

export function useManageableTemplates(enabled = true) {
	const { account } = useAuth();

	return useQuery({
		queryKey: queryKeys.manageableTemplates,
		queryFn: () => listManageableTemplates(),
		enabled: Boolean(account) && enabled,
	});
}

export function useSystemEmailTemplates(enabled = true) {
	const { account } = useAuth();

	return useQuery({
		queryKey: queryKeys.systemTemplates,
		queryFn: () => listSystemEmailTemplates(),
		enabled: Boolean(account) && enabled,
	});
}

export function useCreateEmailTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createEmailTemplate,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["templates"] });
		},
	});
}

export function useRenameEmailTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			renameEmailTemplate(id, name),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["templates"] });
		},
	});
}

export function useDeleteEmailTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteEmailTemplate,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["templates"] });
		},
	});
}

export function useUploadSystemEmailTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			key,
			file,
		}: {
			key: SystemEmailTemplateKey;
			file: File;
		}) => uploadSystemEmailTemplate(key, file),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.systemTemplates,
			});
		},
	});
}

export function useDeleteSystemEmailTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (key: SystemEmailTemplateKey) =>
			deleteSystemEmailTemplate(key),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.systemTemplates,
			});
		},
	});
}
