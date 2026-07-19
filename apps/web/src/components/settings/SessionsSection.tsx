import { useCallback, useEffect, useState } from "react";
import { Loader2, MonitorSmartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchSessions, revokeAllSessions, revokeSession } from "@/lib/auth/api";
import type { AuthSession } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";

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

type RevokeAllMode = "others" | "all";

export function SessionsSection() {
	const { t } = useTranslation("settings");
	const { refresh } = useAuth();
	const [sessions, setSessions] = useState<AuthSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [revokeAllMode, setRevokeAllMode] = useState<RevokeAllMode | null>(null);
	const [revokingAll, setRevokingAll] = useState(false);

	const loadSessions = useCallback(async () => {
		setError(null);
		try {
			const result = await fetchSessions();
			setSessions(result.items);
		} catch (loadError) {
			setError(getErrorMessage(loadError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSessions();
	}, [loadSessions]);

	const handleSignedOutCurrent = async () => {
		try {
			await refresh();
		} catch {
			// RequireAuth will redirect once account is cleared.
		}
	};

	const handleRevoke = async (sessionId: string) => {
		setRevokingId(sessionId);
		setError(null);
		try {
			const result = await revokeSession(sessionId);
			if (result.signedOutCurrent) {
				await handleSignedOutCurrent();
				return;
			}
			setSessions((current) => current.filter((session) => session.id !== sessionId));
		} catch (revokeError) {
			setError(getErrorMessage(revokeError));
		} finally {
			setRevokingId(null);
		}
	};

	const handleRevokeAll = async () => {
		if (!revokeAllMode) {
			return;
		}
		setRevokingAll(true);
		setError(null);
		try {
			const result = await revokeAllSessions({
				includeCurrent: revokeAllMode === "all",
			});
			setRevokeAllMode(null);
			if (result.signedOutCurrent) {
				await handleSignedOutCurrent();
				return;
			}
			await loadSessions();
		} catch (revokeError) {
			setError(getErrorMessage(revokeError));
		} finally {
			setRevokingAll(false);
		}
	};

	const otherSessions = sessions.filter((session) => !session.current);

	return (
		<>
			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="flex items-center gap-2 text-base">
						<MonitorSmartphone className="text-muted-foreground size-4" aria-hidden />
						{t("sessions.title")}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						{t("sessions.description")}
					</p>

					{error ? (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}

					{loading ? (
						<div className="space-y-2">
							{Array.from({ length: 2 }).map((_, index) => (
								<Skeleton key={index} className="h-16 w-full rounded-lg" />
							))}
						</div>
					) : sessions.length === 0 ? (
						<p className="text-muted-foreground text-sm">{t("sessions.empty")}</p>
					) : (
						<Card className="gap-0 rounded-lg py-0">
							<CardContent className="p-0">
								<ul className="divide-border divide-y">
									{sessions.map((session) => (
										<SessionRow
											key={session.id}
											session={session}
											revoking={revokingId === session.id}
											onRevoke={() => handleRevoke(session.id)}
										/>
									))}
								</ul>
							</CardContent>
						</Card>
					)}

					{sessions.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{otherSessions.length > 0 ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setRevokeAllMode("others")}
									disabled={Boolean(revokingId) || revokingAll}
								>
									{t("sessions.signOutOthers")}
								</Button>
							) : null}
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setRevokeAllMode("all")}
								disabled={Boolean(revokingId) || revokingAll}
							>
								{t("sessions.signOutAll")}
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>

			<ConfirmDialog
				open={revokeAllMode !== null}
				onOpenChange={(open) => !open && !revokingAll && setRevokeAllMode(null)}
				title={
					revokeAllMode === "all"
						? t("sessions.confirmAllTitle")
						: t("sessions.confirmOthersTitle")
				}
				description={
					revokeAllMode === "all" ? (
						<p>{t("sessions.confirmAllBody")}</p>
					) : (
						<p>{t("sessions.confirmOthersBody")}</p>
					)
				}
				confirmLabel={
					revokeAllMode === "all"
						? t("sessions.confirmAllLabel")
						: t("sessions.confirmOthersLabel")
				}
				onConfirm={handleRevokeAll}
				pending={revokingAll}
			/>
		</>
	);
}

function SessionRow({
	session,
	revoking,
	onRevoke,
}: {
	session: AuthSession;
	revoking: boolean;
	onRevoke: () => void;
}) {
	const { t } = useTranslation("settings");
	const location = formatLocation(session);

	const formatDevice = (s: AuthSession): string => {
		const parts = [s.browser, s.os].filter(Boolean);
		if (parts.length === 2) {
			return t("sessions.deviceOn", { browser: s.browser, os: s.os });
		}
		if (parts.length === 1) {
			return parts[0]!;
		}
		return t("sessions.unknownDevice");
	};

	return (
		<li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm">
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium">{formatDevice(session)}</p>
					{session.current ? (
						<Badge variant="success">{t("sessions.currentBadge")}</Badge>
					) : null}
				</div>
				<p className="text-muted-foreground text-xs">
					{t("sessions.seenMeta", {
						createdAt: formatDateTime(session.createdAt),
						lastSeenAt: formatDateTime(session.lastSeenAt),
					})}
				</p>
				{location || session.ipAddress ? (
					<p className="text-muted-foreground text-xs">
						{location ?? t("sessions.unknownLocation")}
						{session.ipAddress ? ` · ${session.ipAddress}` : ""}
					</p>
				) : null}
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={onRevoke}
				disabled={revoking}
				className="shrink-0"
			>
				{revoking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
				{t("sessions.signOut")}
			</Button>
		</li>
	);
}
