import { useState } from "react";
import {
	ChevronDown,
	Loader2,
	MonitorSmartphone,
	ShieldCheck,
	ShieldOff,
} from "lucide-react";

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

function formatDevice(session: AuthSession): string {
	const parts = [session.browser, session.os].filter(Boolean);
	if (parts.length > 0) {
		return parts.join(" on ");
	}
	return "Unknown device";
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
			setSuccess("Session signed out.");
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
			setSuccess("All sessions have been signed out.");
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
			setSuccess("Two-factor authentication has been disabled.");
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
						Two-factor authentication
					</p>
					<p className="text-muted-foreground text-xs">
						{mfaEnabled
							? "This person uses an authenticator app when signing in."
							: "Two-factor authentication is not enabled for this account."}
					</p>
				</div>

				{mfaQuery.isLoading ? (
					<Skeleton className="h-10 w-full rounded-lg" />
				) : mfaEnabled ? (
					<div className="space-y-3">
						<p className="text-sm">
							Enabled{mfaEnabledAt ? ` since ${mfaEnabledAt}` : ""}.
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
										Disable two-factor authentication
									</p>
									<p className="text-muted-foreground text-xs">
										Removes the authenticator requirement for this account.
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
										They will only need their password to sign in until they set up
										2FA again.
									</p>
									<Button
										variant="destructive"
										size="sm"
										onClick={() => setConfirmDisableMfa(true)}
										disabled={isBusy}
									>
										Disable 2FA
									</Button>
								</div>
							) : null}
						</div>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						Nothing to manage here until 2FA is enabled.
					</p>
				)}
			</div>

			<div className="bg-muted/30 space-y-3 rounded-lg border p-4">
				<div>
					<p className="flex items-center gap-2 text-sm font-medium">
						<MonitorSmartphone className="text-muted-foreground size-4" aria-hidden />
						Sessions
					</p>
					<p className="text-muted-foreground text-xs">
						Active sign-ins for {displayName}. Revoking a session signs them out on
						that device.
					</p>
				</div>

				{sessionsQuery.isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 2 }).map((_, index) => (
							<Skeleton key={index} className="h-16 w-full rounded-lg" />
						))}
					</div>
				) : sessions.length === 0 ? (
					<p className="text-muted-foreground text-sm">No active sessions found.</p>
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
						Sign out all sessions
					</Button>
				) : null}
			</div>

			<ConfirmDialog
				open={confirmRevokeAll}
				onOpenChange={(open) => !open && !revokeAllMutation.isPending && setConfirmRevokeAll(open)}
				title="Sign out all sessions?"
				description={
					<p>
						This will sign {displayName} out on every device. They will need to sign
						in again.
					</p>
				}
				confirmLabel="Sign out all sessions"
				onConfirm={handleRevokeAll}
				pending={revokeAllMutation.isPending}
			/>

			<ConfirmDialog
				open={confirmDisableMfa}
				onOpenChange={(open) =>
					!open && !disableMfaMutation.isPending && setConfirmDisableMfa(open)
				}
				title="Disable two-factor authentication?"
				description={
					<p>
						This removes 2FA from {displayName}&apos;s account. They will only need
						their password to sign in until they set up 2FA again.
					</p>
				}
				confirmLabel="Disable 2FA"
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
	const location = formatLocation(session);

	return (
		<li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm">
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium">{formatDevice(session)}</p>
					{session.current ? (
						<Badge variant="success">Current session</Badge>
					) : null}
				</div>
				<p className="text-muted-foreground text-xs">
					First seen {formatDateTime(session.createdAt)}
					{" · "}
					Last seen {formatDateTime(session.lastSeenAt)}
				</p>
				{location || session.ipAddress ? (
					<p className="text-muted-foreground text-xs">
						{location ?? "Unknown location"}
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
				Sign out
			</Button>
		</li>
	);
}
