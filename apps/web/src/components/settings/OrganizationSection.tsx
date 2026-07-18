import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ComposeEditor } from "@/components/compose/ComposeEditor";
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
	const [identitySelfServe, setIdentitySelfServe] = useState(true);
	const [customNameAllowance, setCustomNameAllowance] = useState(false);
	const [defaultIdentityNamePattern, setDefaultIdentityNamePattern] =
		useState("first_name_last_name");
	const [defaultIdentityCustomName, setDefaultIdentityCustomName] =
		useState("");
	const [defaultIdentitySignatureHtml, setDefaultIdentitySignatureHtml] =
		useState("");
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
			setIdentitySelfServe(settingsQuery.data.identitySelfServe);
			setCustomNameAllowance(settingsQuery.data.customNameAllowance);
			setDefaultIdentityNamePattern(
				settingsQuery.data.defaultIdentityNamePattern,
			);
			setDefaultIdentityCustomName(
				settingsQuery.data.defaultIdentityCustomName ?? "",
			);
			setDefaultIdentitySignatureHtml(
				settingsQuery.data.defaultIdentitySignatureHtml ?? "",
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
		persistNoreplyOutboundEmails !== baseline.persistNoreplyOutboundEmails ||
		identitySelfServe !== baseline.identitySelfServe ||
		customNameAllowance !== baseline.customNameAllowance ||
		defaultIdentityNamePattern !== baseline.defaultIdentityNamePattern ||
		defaultIdentityCustomName !==
			(baseline.defaultIdentityCustomName ?? "") ||
		defaultIdentitySignatureHtml !==
			(baseline.defaultIdentitySignatureHtml ?? "");

	const handleSave = () => {
		setError(null);
		setSaved(false);
		updateMutation.mutate(
			{
				organizationTabAccess,
				requireMfaScope,
				requireRecoveryEmail,
				persistNoreplyOutboundEmails,
				identitySelfServe,
				customNameAllowance,
				defaultIdentityNamePattern,
				defaultIdentityCustomName:
					defaultIdentityNamePattern === "custom"
						? defaultIdentityCustomName.trim() || null
						: null,
				defaultIdentitySignatureHtml:
					defaultIdentitySignatureHtml.trim() || null,
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

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">Identities</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Identity self-serve</p>
							<p className="text-muted-foreground text-sm">
								Allow accounts to create and edit identities on their primary
								mailbox (the organization default identity stays locked).
							</p>
						</div>
						<Switch
							checked={identitySelfServe}
							disabled={updateMutation.isPending}
							onCheckedChange={(checked) => {
								setIdentitySelfServe(checked);
								setSaved(false);
							}}
							aria-label="Identity self-serve"
						/>
					</div>
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Allow custom names</p>
							<p className="text-muted-foreground text-sm">
								Let users and managers choose a free-form From name. Admins and
								above can always use custom names.
							</p>
						</div>
						<Switch
							checked={customNameAllowance}
							disabled={updateMutation.isPending}
							onCheckedChange={(checked) => {
								setCustomNameAllowance(checked);
								setSaved(false);
							}}
							aria-label="Allow custom names"
						/>
					</div>
					<div className="space-y-3 border-t pt-4">
						<p className="text-sm font-medium">Default identity</p>
						<p className="text-muted-foreground text-sm">
							Live-linked template offered on every primary mailbox. Changes
							apply immediately for all accounts.
						</p>
						<div className="space-y-2">
							<label
								htmlFor="default-identity-pattern"
								className="text-sm font-medium"
							>
								Name pattern
							</label>
							<select
								id="default-identity-pattern"
								className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
								value={defaultIdentityNamePattern}
								disabled={updateMutation.isPending}
								onChange={(event) => {
									setDefaultIdentityNamePattern(event.target.value);
									setSaved(false);
								}}
							>
								<option value="none">No name (address only)</option>
								<option value="first_name">First name</option>
								<option value="last_name">Last name</option>
								<option value="first_name_last_name">
									First name Last name
								</option>
								<option value="last_name_first_name">
									Last name First name
								</option>
								<option value="first_initial_last_name">F. Last name</option>
								<option value="last_name_first_initial">Last name F.</option>
								<option value="first_name_last_initial">First name L.</option>
								<option value="last_initial_first_name">L. First name</option>
								<option value="custom">Custom name</option>
							</select>
						</div>
						{defaultIdentityNamePattern === "custom" ? (
							<div className="space-y-2">
								<label
									htmlFor="default-identity-custom"
									className="text-sm font-medium"
								>
									Custom name
								</label>
								<input
									id="default-identity-custom"
									className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
									value={defaultIdentityCustomName}
									disabled={updateMutation.isPending}
									onChange={(event) => {
										setDefaultIdentityCustomName(event.target.value);
										setSaved(false);
									}}
								/>
							</div>
						) : null}
						<div className="space-y-2">
							<label className="text-sm font-medium">Signature</label>
							<ComposeEditor
								key={baseline.updatedAt}
								initialHtml={
									baseline.defaultIdentitySignatureHtml || "<p></p>"
								}
								placeholder="Optional default signature…"
								disabled={updateMutation.isPending}
								className="min-h-[140px]"
								onChange={({ html }) => {
									setDefaultIdentitySignatureHtml(html);
									setSaved(false);
								}}
							/>
						</div>
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
