import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDomains } from "@/hooks/use-domains";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

type AccountItem = {
	id: string;
	loginIdentifier: string;
	role: string | null;
	status: string;
};

async function fetchAccounts(): Promise<AccountItem[]> {
	const response = await fetch(apiUrl("/accounts"), { credentials: "include" });
	if (!response.ok) {
		throw new Error("Failed to load accounts");
	}
	const data = (await response.json()) as { items: AccountItem[] };
	return data.items;
}

export function AccountsSection() {
	const { account } = useAuth();
	const domainsQuery = useDomains();
	const queryClient = useQueryClient();
	const [domainId, setDomainId] = useState("");
	const [localPart, setLocalPart] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const accountsQuery = useQuery({
		queryKey: ["accounts"],
		queryFn: fetchAccounts,
		enabled:
			!!account &&
			(account.isIntendant ||
				account.role === "superadmin" ||
				account.role === "admin" ||
				account.role === "manager"),
	});

	const inviteMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch(apiUrl("/accounts/invite"), {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					domainId,
					localPart,
					firstName,
					lastName,
				}),
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(getErrorMessage(body) ?? "Invite failed");
			}
			return response.json() as Promise<{ inviteCode: string; address: string }>;
		},
		onSuccess: (data) => {
			setInviteCode(data.inviteCode);
			setError(null);
			void queryClient.invalidateQueries({ queryKey: ["accounts"] });
		},
		onError: (err) => setError(err instanceof Error ? err.message : "Invite failed"),
	});

	if (
		!account ||
		(!account.isIntendant &&
			account.role !== "superadmin" &&
			account.role !== "admin" &&
			account.role !== "manager")
	) {
		return (
			<p className="text-muted-foreground text-sm">
				You do not have permission to manage accounts.
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Invite account</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<select
						className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
						value={domainId}
						onChange={(event) => setDomainId(event.target.value)}
					>
						<option value="">Select domain</option>
						{(domainsQuery.data ?? []).map((domain) => (
							<option key={domain.id} value={domain.id}>
								{domain.name}
							</option>
						))}
					</select>
					<Input
						placeholder="Local part (e.g. patrick)"
						value={localPart}
						onChange={(event) => setLocalPart(event.target.value)}
					/>
					<div className="grid grid-cols-2 gap-3">
						<Input
							placeholder="First name"
							value={firstName}
							onChange={(event) => setFirstName(event.target.value)}
						/>
						<Input
							placeholder="Last name"
							value={lastName}
							onChange={(event) => setLastName(event.target.value)}
						/>
					</div>
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					{inviteCode ? (
						<p className="text-sm">
							Invite code: <strong>{inviteCode}</strong>
						</p>
					) : null}
					<Button
						onClick={() => inviteMutation.mutate()}
						disabled={!domainId || !localPart || inviteMutation.isPending}
					>
						Create invite
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Accounts</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{(accountsQuery.data ?? []).map((item) => (
						<div
							key={item.id}
							className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
						>
							<span>{item.loginIdentifier}</span>
							<span className="text-muted-foreground">
								{item.role ?? "intendant"} · {item.status}
							</span>
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
