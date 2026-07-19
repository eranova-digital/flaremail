import { useState } from "react";
import {
	ChevronDown,
	Loader2,
	MonitorSmartphone,
	ShieldCheck,
	ShieldOff,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useAccountMfaStatus,
	useAccountSessions,
	useDisableAccountMfa,
	useRevokeAccountSession,
	useRevokeAllAccountSessions,
} from "@/hooks/use-accounts";
import type { AuthSession } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const countryDisplay = new Intl.DisplayNames(undefined, { type: "region" });

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatLocation(session: AuthSession): string | null {
	if (session.countryCode && session.countryCode !== "XX" && session.countryCode !== "T1") {
		try {
			const country = countryDisplay.of(session.countryCode);
			if (country) {
				return country;
			}
		} catch {
			// Fall through to country code.
		}
		return session.countryCode;
	}
	return null;
}

function formatDevice(
	session: AuthSession,
	t: (key: string, options?: Record<string, string>) => string,
): string {
	const parts = [session.browser, session.os].filter(Boolean);
	if (parts.length === 2) {
		return t("accounts.security.deviceOn", {
			browser: session.browser!,
			os: session.os!,
		});
	}
	if (parts.length === 1) {
		return parts[0]!;
	}
	return t("accounts.security.unknownDevice");
}

function formatEnabledDate(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}
	return new Date(value).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

type AccountSecurityTabProps = {
	accountId: string;
	displayName: string;
};

export function AccountSecurityTab({
	accountId,
	displayName,
}: AccountSecurityTabProps) {
	const { t } = useTranslation("management");
	const sessionsQuery = useAccountSessions(accountId);
	const mfaQuery = useAccountMfaStatus(accountId);
	const revokeSessionMutation = useRevokeAccountSession();
	const revokeAllMutation = useRevokeAllAccountSessions();
	const disableMfaMutation = useDisableAccountMfa();

	const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
	const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
	const [disableOpen, setDisableOpen] = useState(false);
	const [confirmDisableMfa, setConfirmDisableMfa] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const sessions = sessionsQuery.data ?? [];
	const mfaEnabled = mfaQuery.data?.enabled ?? false;
	const mfaEnabledAt = formatEnabledDate(mfaQuery.data?.enabledAt);

	const handleRevokeSession = async (sessionId: string) => {
		setRevokingSessionId(sessionId);
		setError(null);
		try {
			await revokeSessionMutation.mutateAsync({ accountId, sessionId });
			setSuccess(t("accounts.security.sessionSignedOut"));
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setRevokingSessionId(null);
		}
	};

	const handleRevokeAll = async () => {
		setError(null);
		try {
			await revokeAllMutation.mutateAsync(accountId);
			setConfirmRevokeAll(false);
			setSuccess(t("accounts.security.allSessionsSignedOut"));
		} catch (err) {
			setError(getErrorMessage(err));
		}
	};

	const handleDisableMfa = async () => {
		setError(null);
		try {
			await disableMfaMutation.mutateAsync(accountId);
			setConfirmDisableMfa(false);
			setDisableOpen(false);
			setSuccess(t("accounts.security.mfaDisabledSuccess"));
		} catch (err) {
			setError(getErrorMessage(err));
		}
	};

	const isBusy =
		revokeSessionMutation.isPending ||
		revokeAllMutation.isPending ||
		disableMfaMutation.isPending;

	return (
		<div className="space-y-4">
			{error ? (
				<Alert tone="destructive">
					<p>{error}</p>
				</Alert>
			) : null}
			{success ? (
				<Alert tone="success">
					<p>{success}</p>
				</Alert>
			) : null}

			<div className="bg-muted/30 space-y-3 rounded-lg border p-4">
				<div>
					<p className="flex items-center gap-2 text-sm font-medium">
						{mfaEnabled ? (
							<ShieldCheck className="text-primary size-4" aria-hidden />
						) : (
							<ShieldOff className="text-muted-foreground size-4" aria-hidden />
						)}
						{t("accounts.security.mfaTitle")}
					</p>
					<p className="text-muted-foreground text-xs">
						{mfaEnabled
							? t("accounts.security.mfaEnabledDesc")
							: t("accounts.security.mfaDisabledDesc")}
					</p>
				</div>

				{mfaQuery.isLoading ? (
					<Skeleton className="h-10 w-full rounded-lg" />
				) : mfaEnabled ? (
					<div className="space-y-3">
						<p className="text-sm">
							{mfaEnabledAt
								? t("accounts.security.enabledSince", { date: mfaEnabledAt })
								: t("accounts.security.enabled")}
						</p>
						<div className="rounded-md border">
							<button
								type="button"
								onClick={() => setDisableOpen((current) => !current)}
								aria-expanded={disableOpen}
								className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
							>
								<div>
									<p className="text-sm font-medium">
										{t("accounts.security.disableTitle")}
									</p>
									<p className="text-muted-foreground text-xs">
										{t("accounts.security.disableDesc")}
									</p>
								</div>
								<ChevronDown
									className={cn(
										"text-muted-foreground size-4 shrink-0 transition-transform",
										disableOpen && "rotate-180",
									)}
								/>
							</button>
							{disableOpen ? (
								<div className="space-y-3 border-t px-3 py-3">
									<p className="text-muted-foreground text-sm">
										{t("accounts.security.disableHint")}
									</p>
									<Button
										variant="destructive"
										size="sm"
										onClick={() => setConfirmDisableMfa(true)}
										disabled={isBusy}
									>
										{t("accounts.security.disableButton")}
									</Button>
								</div>
							) : null}
						</div>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						{t("accounts.security.nothingToManage")}
					</p>
				)}
			</div>

			<div className="bg-muted/30 space-y-3 rounded-lg border p-4">
				<div>
					<p className="flex items-center gap-2 text-sm font-medium">
						<MonitorSmartphone className="text-muted-foreground size-4" aria-hidden />
						{t("accounts.security.sessionsTitle")}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("accounts.security.sessionsDesc", { name: displayName })}
					</p>
				</div>

				{sessionsQuery.isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 2 }).map((_, index) => (
							<Skeleton key={index} className="h-16 w-full rounded-lg" />
						))}
					</div>
				) : sessions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("accounts.security.noSessions")}
					</p>
				) : (
					<Card className="gap-0 rounded-lg py-0">
						<CardContent className="p-0">
							<ul className="divide-border divide-y">
								{sessions.map((session) => (
									<SessionRow
										key={session.id}
										session={session}
										revoking={revokingSessionId === session.id}
										onRevoke={() => handleRevokeSession(session.id)}
										disabled={isBusy}
									/>
								))}
							</ul>
						</CardContent>
					</Card>
				)}

				{sessions.length > 0 ? (
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setConfirmRevokeAll(true)}
						disabled={isBusy}
					>
						{t("accounts.security.signOutAll")}
					</Button>
				) : null}
			</div>

			<ConfirmDialog
				open={confirmRevokeAll}
				onOpenChange={(open) => !open && !revokeAllMutation.isPending && setConfirmRevokeAll(open)}
				title={t("accounts.security.signOutAllConfirm.title")}
				description={
					<p>
						{t("accounts.security.signOutAllConfirm.description", { name: displayName })}
					</p>
				}
				confirmLabel={t("accounts.security.signOutAll")}
				onConfirm={handleRevokeAll}
				pending={revokeAllMutation.isPending}
			/>

			<ConfirmDialog
				open={confirmDisableMfa}
				onOpenChange={(open) =>
					!open && !disableMfaMutation.isPending && setConfirmDisableMfa(open)
				}
				title={t("accounts.security.disableMfaConfirm.title")}
				description={
					<p>
						{t("accounts.security.disableMfaConfirm.description", { name: displayName })}
					</p>
				}
				confirmLabel={t("accounts.security.disableButton")}
				onConfirm={handleDisableMfa}
				pending={disableMfaMutation.isPending}
			/>
		</div>
	);
}

function SessionRow({
	session,
	revoking,
	onRevoke,
	disabled,
}: {
	session: AuthSession;
	revoking: boolean;
	onRevoke: () => void;
	disabled: boolean;
}) {
	const { t } = useTranslation("management");
	const location = formatLocation(session);

	return (
		<li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm">
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium">{formatDevice(session, t)}</p>
					{session.current ? (
						<Badge variant="success">{t("accounts.security.currentSession")}</Badge>
					) : null}
				</div>
				<p className="text-muted-foreground text-xs">
					{t("accounts.security.firstSeen", {
						datetime: formatDateTime(session.createdAt),
					})}
					{" · "}
					{t("accounts.security.lastSeen", {
						datetime: formatDateTime(session.lastSeenAt),
					})}
				</p>
				{location || session.ipAddress ? (
					<p className="text-muted-foreground text-xs">
						{location ?? t("accounts.security.unknownLocation")}
						{session.ipAddress ? ` · ${session.ipAddress}` : ""}
					</p>
				) : null}
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={onRevoke}
				disabled={disabled || revoking}
				className="shrink-0"
			>
				{revoking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
				{t("accounts.security.signOut")}
			</Button>
		</li>
	);
}
