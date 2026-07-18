import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { ComposeEditor } from "@/components/compose/ComposeEditor";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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

function SettingRow({
	label,
	description,
	control,
	className,
}: {
	label: string;
	description: ReactNode;
	control: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
				className,
			)}
		>
			<div className="min-w-0 space-y-1 sm:pr-6">
				<p className="text-sm font-medium">{label}</p>
				<p className="text-muted-foreground text-xs leading-relaxed">
					{description}
				</p>
			</div>
			<div className="shrink-0 sm:w-56">{control}</div>
		</div>
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

	const markDirty = () => setSaved(false);

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
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Access & security</CardTitle>
				</CardHeader>
				<CardContent className="divide-y p-0">
					<div className="px-6 py-4">
						<SettingRow
							label="Organization tab access"
							description={
								isIntendant
									? "Who can view this Organization tab in Management. Only you can change this setting."
									: "Who can view this Organization tab in Management. Only the recovery account can change this setting."
							}
							control={
								<Select
									value={organizationTabAccess}
									disabled={!isIntendant || updateMutation.isPending}
									onValueChange={(value) => {
										setOrganizationTabAccess(value as OrganizationTabAccess);
										markDirty();
									}}
								>
									<SelectTrigger aria-label="Organization tab access">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ORGANIZATION_TAB_ACCESS_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
					</div>
					<div className="px-6 py-4">
						<SettingRow
							label="Require two-factor authentication"
							description="Accounts in scope must enable 2FA during activation or on their next sign-in."
							control={
								<Select
									value={requireMfaScope}
									disabled={updateMutation.isPending}
									onValueChange={(value) => {
										setRequireMfaScope(value as RequireMfaScope);
										markDirty();
									}}
								>
									<SelectTrigger aria-label="Require two-factor authentication">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{REQUIRE_MFA_SCOPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
					</div>
					<div className="px-6 py-4">
						<SettingRow
							label="Require recovery email"
							description="Every account must verify a recovery email during activation or on their next sign-in."
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={requireRecoveryEmail}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setRequireRecoveryEmail(checked);
											markDirty();
										}}
										aria-label="Require recovery email"
									/>
								</div>
							}
						/>
					</div>
					<div className="px-6 py-4">
						<SettingRow
							label="Persist noreply outbound emails"
							description={
								<>
									Keep copies of transactional emails from{" "}
									<code className="text-[11px]">noreply@</code> in each
									domain&apos;s noreply Sent folder.
								</>
							}
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={persistNoreplyOutboundEmails}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setPersistNoreplyOutboundEmails(checked);
											markDirty();
										}}
										aria-label="Persist noreply outbound emails"
									/>
								</div>
							}
						/>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Identities</CardTitle>
				</CardHeader>
				<CardContent className="divide-y p-0">
					<div className="px-6 py-4">
						<SettingRow
							label="Identity self-serve"
							description="Allow accounts to create and edit identities on their primary mailbox. The organization default identity stays locked."
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={identitySelfServe}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setIdentitySelfServe(checked);
											markDirty();
										}}
										aria-label="Identity self-serve"
									/>
								</div>
							}
						/>
					</div>
					<div className="px-6 py-4">
						<SettingRow
							label="Allow custom names"
							description="Let users and managers choose a free-form From name. Admins and above can always use custom names."
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={customNameAllowance}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setCustomNameAllowance(checked);
											markDirty();
										}}
										aria-label="Allow custom names"
									/>
								</div>
							}
						/>
					</div>
					<div id="default-identity" className="space-y-4 px-6 py-4 scroll-mt-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Default identity</p>
							<p className="text-muted-foreground text-xs leading-relaxed">
								Live-linked template offered on every primary mailbox. Changes
								apply immediately for all accounts.
							</p>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<label
									htmlFor="default-identity-pattern"
									className="text-sm font-medium"
								>
									Name pattern
								</label>
								<Select
									value={defaultIdentityNamePattern}
									disabled={updateMutation.isPending}
									onValueChange={(value) => {
										setDefaultIdentityNamePattern(value);
										markDirty();
									}}
								>
									<SelectTrigger
										id="default-identity-pattern"
										aria-label="Name pattern"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">No name (address only)</SelectItem>
										<SelectItem value="first_name">First name</SelectItem>
										<SelectItem value="last_name">Last name</SelectItem>
										<SelectItem value="first_name_last_name">
											First name Last name
										</SelectItem>
										<SelectItem value="last_name_first_name">
											Last name First name
										</SelectItem>
										<SelectItem value="first_initial_last_name">
											F. Last name
										</SelectItem>
										<SelectItem value="last_name_first_initial">
											Last name F.
										</SelectItem>
										<SelectItem value="first_name_last_initial">
											First name L.
										</SelectItem>
										<SelectItem value="last_initial_first_name">
											L. First name
										</SelectItem>
										<SelectItem value="custom">Custom name</SelectItem>
									</SelectContent>
								</Select>
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
										className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
										value={defaultIdentityCustomName}
										disabled={updateMutation.isPending}
										onChange={(event) => {
											setDefaultIdentityCustomName(event.target.value);
											markDirty();
										}}
									/>
								</div>
							) : null}
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Signature</label>
							<ComposeEditor
								key={baseline.updatedAt}
								initialHtml={
									baseline.defaultIdentitySignatureHtml || "<p></p>"
								}
								placeholder="Optional default signature…"
								disabled={updateMutation.isPending}
								className="min-h-[120px]"
								onChange={({ html }) => {
									setDefaultIdentitySignatureHtml(html);
									markDirty();
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
