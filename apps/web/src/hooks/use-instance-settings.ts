import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	fetchInstanceSettings,
	updateInstanceSettings,
	type UpdateInstanceSettingsInput,
} from "@/lib/accounts/instance-settings";
import type { Account } from "@/lib/auth/types";
import { canAccessOrganizationTab } from "@/lib/accounts/permissions";

export const instanceSettingsQueryKeys = {
	all: ["instance-settings"] as const,
};

export function useInstanceSettings(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: instanceSettingsQueryKeys.all,
		queryFn: fetchInstanceSettings,
		enabled: options?.enabled ?? true,
		retry: false,
	});
}

export function useCanAccessOrganizationTab(account: Account | null) {
	const settingsQuery = useInstanceSettings({
		enabled: !!account && (account.isIntendant || account.role === "superadmin"),
	});

	if (!account) {
		return { canAccess: false, isLoading: false };
	}

	if (account.isIntendant) {
		return { canAccess: true, isLoading: false };
	}

	if (account.role !== "superadmin") {
		return { canAccess: false, isLoading: false };
	}

	if (settingsQuery.isLoading) {
		return { canAccess: false, isLoading: true };
	}

	if (settingsQuery.isError || !settingsQuery.data) {
		return { canAccess: false, isLoading: false };
	}

	return {
		canAccess: canAccessOrganizationTab(account),
		isLoading: false,
	};
}

export function useUpdateInstanceSettings() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UpdateInstanceSettingsInput) =>
			updateInstanceSettings(input),
		onSuccess: (data) => {
			queryClient.setQueryData(instanceSettingsQueryKeys.all, data);
		},
	});
}
