import { useEffect, useState, type ReactNode } from "react";
import { Building2, Fingerprint, Loader2, ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

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
	getLogRetentionDayOptions,
	getOrganizationTabAccessOptions,
	getRequireMfaScopeOptions,
	type LogRetentionDays,
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
	const { t } = useTranslation("management");
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
	const [logsEnabled, setLogsEnabled] = useState(true);
	const [maxImportanceStored, setMaxImportanceStored] = useState(10);
	const [logRetentionDays, setLogRetentionDays] =
		useState<LogRetentionDays>(14);
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
			setLogsEnabled(settingsQuery.data.logsEnabled);
			setMaxImportanceStored(settingsQuery.data.maxImportanceStored);
			setLogRetentionDays(settingsQuery.data.logRetentionDays);
		}
	}, [settingsQuery.data]);

	if (settingsQuery.isLoading) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				{t("organization.loading")}
			</div>
		);
	}

	if (settingsQuery.isError || !settingsQuery.data) {
		return (
			<Alert tone="destructive">
				{getErrorMessage(settingsQuery.error) ?? t("organization.loadError")}
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
			(baseline.defaultIdentitySignatureHtml ?? "") ||
		logsEnabled !== baseline.logsEnabled ||
		maxImportanceStored !== baseline.maxImportanceStored ||
		logRetentionDays !== baseline.logRetentionDays;

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
				logsEnabled,
				maxImportanceStored,
				logRetentionDays,
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
				<h2 className="text-lg font-medium">{t("organization.title")}</h2>
				<p className="text-muted-foreground text-sm">{t("organization.description")}</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}
			{saved ? <Alert tone="success">{t("organization.saved")}</Alert> : null}

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Building2 className="text-muted-foreground size-4" aria-hidden />
						{t("organization.accessSecurity")}
					</CardTitle>
				</CardHeader>
				<CardContent className="divide-y p-0">
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.tabAccess.label")}
							description={
								isIntendant
									? t("organization.tabAccess.descIntendant")
									: t("organization.tabAccess.descOther")
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
									<SelectTrigger aria-label={t("organization.tabAccess.label")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{getOrganizationTabAccessOptions().map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
					</div>
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.requireMfa.label")}
							description={t("organization.requireMfa.description")}
							control={
								<Select
									value={requireMfaScope}
									disabled={updateMutation.isPending}
									onValueChange={(value) => {
										setRequireMfaScope(value as RequireMfaScope);
										markDirty();
									}}
								>
									<SelectTrigger aria-label={t("organization.requireMfa.label")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{getRequireMfaScopeOptions().map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
					</div>
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.requireRecoveryEmail.label")}
							description={t("organization.requireRecoveryEmail.description")}
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={requireRecoveryEmail}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setRequireRecoveryEmail(checked);
											markDirty();
										}}
										aria-label={t("organization.requireRecoveryEmail.label")}
									/>
								</div>
							}
						/>
					</div>
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.persistNoreply.label")}
							description={t("organization.persistNoreply.description")}
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={persistNoreplyOutboundEmails}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setPersistNoreplyOutboundEmails(checked);
											markDirty();
										}}
										aria-label={t("organization.persistNoreply.label")}
									/>
								</div>
							}
						/>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Fingerprint className="text-muted-foreground size-4" aria-hidden />
						{t("organization.identitiesCard")}
					</CardTitle>
				</CardHeader>
				<CardContent className="divide-y p-0">
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.identitySelfServe.label")}
							description={t("organization.identitySelfServe.description")}
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={identitySelfServe}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setIdentitySelfServe(checked);
											markDirty();
										}}
										aria-label={t("organization.identitySelfServe.label")}
									/>
								</div>
							}
						/>
					</div>
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.customNames.label")}
							description={t("organization.customNames.description")}
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={customNameAllowance}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setCustomNameAllowance(checked);
											markDirty();
										}}
										aria-label={t("organization.customNames.label")}
									/>
								</div>
							}
						/>
					</div>
					<div id="default-identity" className="space-y-4 px-6 py-3 scroll-mt-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">{t("organization.defaultIdentity.label")}</p>
							<p className="text-muted-foreground text-xs leading-relaxed">
								{t("organization.defaultIdentity.description")}
							</p>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<label
									htmlFor="default-identity-pattern"
									className="text-sm font-medium"
								>
									{t("organization.defaultIdentity.namePattern")}
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
										aria-label={t("organization.defaultIdentity.namePattern")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">
											{t("identities.namePatterns.none")}
										</SelectItem>
										<SelectItem value="first_name">
											{t("identities.namePatterns.first_name")}
										</SelectItem>
										<SelectItem value="last_name">
											{t("identities.namePatterns.last_name")}
										</SelectItem>
										<SelectItem value="first_name_last_name">
											{t("identities.namePatterns.first_name_last_name")}
										</SelectItem>
										<SelectItem value="last_name_first_name">
											{t("identities.namePatterns.last_name_first_name")}
										</SelectItem>
										<SelectItem value="first_initial_last_name">
											{t("identities.namePatterns.first_initial_last_name")}
										</SelectItem>
										<SelectItem value="last_name_first_initial">
											{t("identities.namePatterns.last_name_first_initial")}
										</SelectItem>
										<SelectItem value="first_name_last_initial">
											{t("identities.namePatterns.first_name_last_initial")}
										</SelectItem>
										<SelectItem value="last_initial_first_name">
											{t("identities.namePatterns.last_initial_first_name")}
										</SelectItem>
										<SelectItem value="custom">
											{t("identities.namePatterns.custom")}
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{defaultIdentityNamePattern === "custom" ? (
								<div className="space-y-2">
									<label
										htmlFor="default-identity-custom"
										className="text-sm font-medium"
									>
										{t("organization.defaultIdentity.customName")}
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
							<label className="text-sm font-medium">{t("organization.defaultIdentity.signature")}</label>
							<ComposeEditor
								key={baseline.updatedAt}
								initialHtml={
									baseline.defaultIdentitySignatureHtml || "<p></p>"
								}
								placeholder={t("organization.defaultIdentity.signaturePlaceholder")}
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

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<ScrollText className="text-muted-foreground size-4" aria-hidden />
						{t("organization.logsCard")}
					</CardTitle>
				</CardHeader>
				<CardContent className="divide-y p-0">
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.logsEnabled.label")}
							description={t("organization.logsEnabled.description")}
							control={
								<div className="flex h-9 items-center justify-end">
									<Switch
										checked={logsEnabled}
										disabled={updateMutation.isPending}
										onCheckedChange={(checked) => {
											setLogsEnabled(checked);
											markDirty();
										}}
										aria-label={t("organization.logsEnabled.label")}
									/>
								</div>
							}
						/>
					</div>
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.maxImportance.label")}
							description={t("organization.maxImportance.description")}
							control={
								<Select
									value={String(maxImportanceStored)}
									disabled={updateMutation.isPending}
									onValueChange={(value) => {
										setMaxImportanceStored(Number(value));
										markDirty();
									}}
								>
									<SelectTrigger aria-label={t("organization.maxImportance.label")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Array.from({ length: 11 }, (_, i) => (
											<SelectItem key={i} value={String(i)}>
												{t("organization.maxImportance.option", { n: i })}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
					</div>
					<div className="px-6 py-3">
						<SettingRow
							label={t("organization.retention.label")}
							description={t("organization.retention.description")}
							control={
								<Select
									value={String(logRetentionDays)}
									disabled={updateMutation.isPending}
									onValueChange={(value) => {
										setLogRetentionDays(Number(value) as LogRetentionDays);
										markDirty();
									}}
								>
									<SelectTrigger aria-label={t("organization.retention.label")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{getLogRetentionDayOptions().map((option) => (
											<SelectItem
												key={option.value}
												value={String(option.value)}
											>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							}
						/>
					</div>
				</CardContent>
			</Card>

			<Button onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
				{updateMutation.isPending ? (
					<Loader2 className="size-4 animate-spin" aria-hidden />
				) : null}
				{t("organization.save")}
			</Button>
		</section>
	);
}
