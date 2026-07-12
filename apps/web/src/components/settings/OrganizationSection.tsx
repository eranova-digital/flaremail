import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
	ORGANIZATION_TAB_ACCESS_OPTIONS,
	REQUIRE_MFA_SCOPE_OPTIONS,
	type OrganizationTabAccess,
	type RequireMfaScope,
} from "@/lib/accounts/instance-settings";
import {
	useInstanceSettings,
	useUpdateInstanceSettings,
} from "@/hooks/use-instance-settings";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type SettingOptionProps<T extends string> = {
	name: string;
	value: T;
	currentValue: T;
	label: string;
	description: string;
	disabled?: boolean;
	onChange: (value: T) => void;
};

function SettingOption<T extends string>({
	name,
	value,
	currentValue,
	label,
	description,
	disabled = false,
	onChange,
}: SettingOptionProps<T>) {
	const selected = value === currentValue;

	return (
		<label
			className={cn(
				"flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors",
				selected && "border-primary bg-primary/5",
				disabled && "cursor-not-allowed opacity-60",
			)}
		>
			<input
				type="radio"
				name={name}
				value={value}
				checked={selected}
				disabled={disabled}
				onChange={() => onChange(value)}
				className="mt-1"
			/>
			<span className="space-y-1">
				<span className="block text-sm font-medium">{label}</span>
				<span className="text-muted-foreground block text-xs">{description}</span>
			</span>
		</label>
	);
}

export function OrganizationSection() {
	const { account } = useAuth();
	const settingsQuery = useInstanceSettings();
	const updateMutation = useUpdateInstanceSettings();
	const [organizationTabAccess, setOrganizationTabAccess] =
		useState<OrganizationTabAccess>("intendant_only");
	const [requireMfaScope, setRequireMfaScope] =
		useState<RequireMfaScope>("none");
	const [requireRecoveryEmail, setRequireRecoveryEmail] = useState(false);
	const [persistNoreplyOutboundEmails, setPersistNoreplyOutboundEmails] =
		useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		if (settingsQuery.data) {
			setOrganizationTabAccess(settingsQuery.data.organizationTabAccess);
			setRequireMfaScope(settingsQuery.data.requireMfaScope);
			setRequireRecoveryEmail(settingsQuery.data.requireRecoveryEmail);
			setPersistNoreplyOutboundEmails(
				settingsQuery.data.persistNoreplyOutboundEmails,
			);
		}
	}, [settingsQuery.data]);

	if (settingsQuery.isLoading) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				Loading organization settings…
			</div>
		);
	}

	if (settingsQuery.isError || !settingsQuery.data) {
		return (
			<Alert tone="destructive">
				{getErrorMessage(settingsQuery.error) ??
					"Could not load organization settings."}
			</Alert>
		);
	}

	const isIntendant = account?.isIntendant ?? false;
	const baseline = settingsQuery.data;
	const dirty =
		organizationTabAccess !== baseline.organizationTabAccess ||
		requireMfaScope !== baseline.requireMfaScope ||
		requireRecoveryEmail !== baseline.requireRecoveryEmail ||
		persistNoreplyOutboundEmails !== baseline.persistNoreplyOutboundEmails;

	const handleSave = () => {
		setError(null);
		setSaved(false);
		updateMutation.mutate(
			{
				organizationTabAccess,
				requireMfaScope,
				requireRecoveryEmail,
				persistNoreplyOutboundEmails,
			},
			{
				onSuccess: () => setSaved(true),
				onError: (saveError) => setError(getErrorMessage(saveError)),
			},
		);
	};

	return (
		<section className="space-y-6">
			<div>
				<h2 className="text-lg font-medium">Organization</h2>
				<p className="text-muted-foreground text-sm">
					Configure instance-wide security policies for every account.
				</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}
			{saved ? (
				<Alert tone="success">Organization settings saved.</Alert>
			) : null}

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">Organization tab access</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">
						Choose who can view this Organization tab in Management.
						{isIntendant
							? " Only you can change this setting."
							: " Only the recovery account can change this setting."}
					</p>
					<div className="space-y-2">
						{ORGANIZATION_TAB_ACCESS_OPTIONS.map((option) => (
							<SettingOption
								key={option.value}
								name="organization-tab-access"
								value={option.value}
								currentValue={organizationTabAccess}
								label={option.label}
								description={option.description}
								disabled={!isIntendant || updateMutation.isPending}
								onChange={(value) => {
									setOrganizationTabAccess(value);
									setSaved(false);
								}}
							/>
						))}
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">Require two-factor authentication</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">
						Accounts in scope must enable 2FA during activation or on their next
						sign-in before using Flaremail.
					</p>
					<div className="space-y-2">
						{REQUIRE_MFA_SCOPE_OPTIONS.map((option) => (
							<SettingOption
								key={option.value}
								name="require-mfa-scope"
								value={option.value}
								currentValue={requireMfaScope}
								label={option.label}
								description={option.description}
								disabled={updateMutation.isPending}
								onChange={(value) => {
									setRequireMfaScope(value);
									setSaved(false);
								}}
							/>
						))}
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">Require recovery email</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">
						When enabled, every account must verify a recovery email during
						activation or on their next sign-in. Skipping recovery email setup is
						not allowed.
					</p>
					<div className="space-y-2">
						<SettingOption
							name="require-recovery-email"
							value="false"
							currentValue={requireRecoveryEmail ? "true" : "false"}
							label="Optional"
							description="Accounts may skip recovery email setup during activation."
							disabled={updateMutation.isPending}
							onChange={() => {
								setRequireRecoveryEmail(false);
								setSaved(false);
							}}
						/>
						<SettingOption
							name="require-recovery-email"
							value="true"
							currentValue={requireRecoveryEmail ? "true" : "false"}
							label="Required for all accounts"
							description="Every account must set up and verify a recovery email."
							disabled={updateMutation.isPending}
							onChange={() => {
								setRequireRecoveryEmail(true);
								setSaved(false);
							}}
						/>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">
						Persist noreply outbound emails
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">
								Keep copies of system emails in noreply Sent
							</p>
							<p className="text-muted-foreground text-sm">
								When enabled, transactional emails sent from{" "}
								<code className="text-xs">noreply@</code> — such as password
								resets, invite codes, and recovery verification — are stored in
								each domain&apos;s noreply mailbox Sent folder.
							</p>
						</div>
						<Switch
							checked={persistNoreplyOutboundEmails}
							disabled={updateMutation.isPending}
							onCheckedChange={(checked) => {
								setPersistNoreplyOutboundEmails(checked);
								setSaved(false);
							}}
							aria-label="Persist noreply outbound emails"
						/>
					</div>
				</CardContent>
			</Card>

			<Button onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
				{updateMutation.isPending ? (
					<Loader2 className="size-4 animate-spin" aria-hidden />
				) : null}
				Save organization settings
			</Button>
		</section>
	);
}
