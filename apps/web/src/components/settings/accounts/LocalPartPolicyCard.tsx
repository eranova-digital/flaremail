import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDomains } from "@/hooks/use-domains";
import {
	useLocalPartPolicy,
	useUpdateLocalPartPolicy,
} from "@/hooks/use-accounts";
import { canEditLocalPartPolicy } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

const selectClassName =
	"border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

export function LocalPartPolicyCard() {
	const { account } = useAuth();
	const domainsQuery = useDomains();
	const [domainId, setDomainId] = useState("");
	const policyQuery = useLocalPartPolicy(domainId || null);
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
		if (!domainId) {
			return;
		}
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
		<Card>
			<CardHeader>
				<CardTitle>Local part policy</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<select
					className={selectClassName}
					value={domainId}
					onChange={(event) => setDomainId(event.target.value)}
				>
					<option value="">Select domain</option>
					{(domainsQuery.data ?? []).map((domain) => (
						<option key={domain.id} value={domain.id}>
							{domain.domain}
						</option>
					))}
				</select>
				<Input
					placeholder="Pattern e.g. {first_name}.{last_name}"
					value={pattern}
					onChange={(event) => setPattern(event.target.value)}
					disabled={!domainId}
				/>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={enforced}
						onChange={(event) => setEnforced(event.target.checked)}
						disabled={!domainId}
					/>
					Enforce for manager invites
				</label>
				<p className="text-muted-foreground text-xs">
					Tokens: {"{first_name}"}, {"{last_name}"}, {"{last_name_initial}"}
				</p>
				{error ? <p className="text-destructive text-sm">{error}</p> : null}
				<Button
					onClick={handleSave}
					disabled={!domainId || updateMutation.isPending}
				>
					Save policy
				</Button>
			</CardContent>
		</Card>
	);
}
