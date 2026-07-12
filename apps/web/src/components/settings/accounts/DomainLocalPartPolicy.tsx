import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	useLocalPartPolicy,
	useUpdateLocalPartPolicy,
} from "@/hooks/use-accounts";
import { canEditLocalPartPolicy } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

type DomainLocalPartPolicyProps = {
	domainId: string;
};

export function DomainLocalPartPolicy({ domainId }: DomainLocalPartPolicyProps) {
	const { account } = useAuth();
	const policyQuery = useLocalPartPolicy(domainId);
	const updateMutation = useUpdateLocalPartPolicy();
	const [pattern, setPattern] = useState("");
	const [enforced, setEnforced] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (policyQuery.data) {
			setPattern(policyQuery.data.pattern ?? "{first_name}.{last_name}");
			setEnforced(policyQuery.data.enforced);
		}
	}, [policyQuery.data]);

	if (!canEditLocalPartPolicy(account)) {
		return null;
	}

	const handleSave = () => {
		setError(null);
		updateMutation.mutate(
			{
				domainId,
				body: { pattern, enforced },
			},
			{
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	return (
		<div className="bg-muted/30 space-y-3 rounded-md border px-3 py-3">
			<div>
				<p className="text-sm font-medium">Local part policy</p>
				<p className="text-muted-foreground text-xs">
					Controls how mailbox addresses are suggested when inviting users.
				</p>
			</div>
			<Input
				placeholder="Pattern e.g. {first_name}.{last_name}"
				value={pattern}
				onChange={(event) => setPattern(event.target.value)}
			/>
			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={enforced}
					onChange={(event) => setEnforced(event.target.checked)}
				/>
				Enforce for manager invites
			</label>
			<p className="text-muted-foreground text-xs">
				Tokens: {"{first_name}"}, {"{last_name}"}, {"{first_name_initial}"},{" "}
				{"{last_name_initial}"}, {"{rnd_num}"}, {"{rnd_char}"}
			</p>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
			<Button
				size="sm"
				onClick={handleSave}
				disabled={updateMutation.isPending}
			>
				Save policy
			</Button>
		</div>
	);
}
