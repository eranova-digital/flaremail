import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	useLocalPartPolicy,
	useUpdateLocalPartPolicy,
} from "@/hooks/use-accounts";
import { canEditLocalPartPolicy } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type DomainLocalPartPolicyProps = {
	domainId: string;
};

export function DomainLocalPartPolicy({ domainId }: DomainLocalPartPolicyProps) {
	const { account } = useAuth();
	const policyQuery = useLocalPartPolicy(domainId);
	const updateMutation = useUpdateLocalPartPolicy();
	const [open, setOpen] = useState(false);
	const [pattern, setPattern] = useState("");
	const [enforced, setEnforced] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

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
		setSaved(false);
		updateMutation.mutate(
			{
				domainId,
				body: { pattern, enforced },
			},
			{
				onSuccess: () => setSaved(true),
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	return (
		<div className="rounded-md border">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				aria-expanded={open}
				className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
			>
				<div>
					<p className="text-sm font-medium">Local part policy</p>
					<p className="text-muted-foreground text-xs">
						Controls how mailbox addresses are suggested when inviting users.
					</p>
				</div>
				<ChevronDown
					className={cn(
						"text-muted-foreground size-4 shrink-0 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open ? (
				<div className="space-y-3 border-t px-3 py-3">
					<label htmlFor={`local-part-pattern-${domainId}`} className="text-sm font-medium">
						Address pattern
					</label>
					<Input
						id={`local-part-pattern-${domainId}`}
						placeholder="Pattern e.g. {first_name}.{last_name}"
						value={pattern}
						onChange={(event) => {
							setPattern(event.target.value);
							setSaved(false);
						}}
					/>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={enforced}
							onChange={(event) => {
								setEnforced(event.target.checked);
								setSaved(false);
							}}
						/>
						Enforce for manager invites
					</label>
					<p className="text-muted-foreground text-xs">
						Tokens: {"{first_name}"}, {"{last_name}"}, {"{first_name_initial}"},{" "}
						{"{last_name_initial}"}, {"{rnd_num}"}, {"{rnd_char}"}
					</p>
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					{saved ? (
						<p className="text-muted-foreground text-sm" role="status">
							Policy saved.
						</p>
					) : null}
					<Button
						size="sm"
						onClick={handleSave}
						disabled={updateMutation.isPending}
					>
						Save policy
					</Button>
				</div>
			) : null}
		</div>
	);
}
