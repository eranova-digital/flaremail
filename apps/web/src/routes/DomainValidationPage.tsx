import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ReadinessBadge } from "@/components/settings/domain-validation/ReadinessBadge";
import { ValidationCheckCard } from "@/components/settings/domain-validation/ValidationCheckCard";
import { ValidationLogs } from "@/components/settings/domain-validation/ValidationLogs";
import { ValidationRunHistory } from "@/components/settings/domain-validation/ValidationRunHistory";
import { SettingsShell } from "@/components/layout/SettingsShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useCancelDomainValidation,
	useDomain,
	useDomainValidationRun,
	useDomainValidationRuns,
	useRecheckDomain,
} from "@/hooks/use-domain-validation";
import { getErrorMessage } from "@/lib/api/errors";
import { formatValidationTimestamp, sortChecks } from "@/lib/domain-validation";
import { canAccessDomainsTab } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

export function DomainValidationPage() {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const { domainId } = useParams();
	const { account } = useAuth();
	const canAccess = canAccessDomainsTab(account);
	const domainQuery = useDomain(domainId, canAccess);
	const runsQuery = useDomainValidationRuns(domainId, canAccess && domainQuery.isSuccess);
	const recheckDomain = useRecheckDomain();
	const cancelValidation = useCancelDomainValidation();
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

	const domain = domainQuery.data;
	const runs = runsQuery.data ?? [];
	const latestRunId = domain?.readiness?.latestRunId ?? runs[0]?.id ?? null;

	useEffect(() => {
		if (!selectedRunId && latestRunId) {
			setSelectedRunId(latestRunId);
		}
	}, [latestRunId, selectedRunId]);

	useEffect(() => {
		if (recheckDomain.data?.id) {
			setSelectedRunId(recheckDomain.data.id);
		}
	}, [recheckDomain.data?.id]);

	const runQuery = useDomainValidationRun(domainId, selectedRunId);
	const selectedRun = runQuery.data;
	const badge = selectedRun?.badge ?? domain?.readiness?.badge;
	const isChecking = badge === "checking" || selectedRun?.status === "checking";
	const isPending = recheckDomain.isPending;
	const isCancelling = cancelValidation.isPending;
	const activeCheckingRunId =
		selectedRun?.status === "checking"
			? selectedRun.id
			: (runs.find((run) => run.status === "checking")?.id ?? null);

	if (!domainId || !canAccess) {
		return <Navigate to="/management?tab=domains" replace />;
	}

	if (domainQuery.isError) {
		return (
			<SettingsShell
				rootLabel={tc("management")}
				rootTo="/management"
				crumbs={[
					{ label: t("domains.title"), to: "/management?tab=domains" },
					{ label: t("domainValidation.crumbFallback") },
				]}
				backTo="/management?tab=domains"
				backLabel={t("shell.backToDomains")}
			>
				<Alert tone="warning" title={t("domainValidation.unavailableTitle")}>
					<p>{getErrorMessage(domainQuery.error)}</p>
				</Alert>
			</SettingsShell>
		);
	}

	return (
		<SettingsShell
			rootLabel={tc("management")}
			rootTo="/management"
			crumbs={[
				{ label: t("domains.title"), to: "/management?tab=domains" },
				{ label: domain?.domain ?? t("domainValidation.crumbFallback") },
			]}
			backTo="/management?tab=domains"
			backLabel={t("shell.backToDomains")}
			widthClassName="max-w-5xl"
			actions={
				isChecking && activeCheckingRunId ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							cancelValidation.mutate({
								domainId,
								runId: activeCheckingRunId,
							})
						}
						disabled={isCancelling || domainQuery.isLoading}
					>
						{t("domainValidation.cancel")}
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						onClick={() => recheckDomain.mutate(domainId)}
						disabled={isPending || isChecking || domainQuery.isLoading}
					>
						<RefreshCw className={cn("size-4", isChecking && "animate-spin")} />
						{isChecking
							? t("domainValidation.checking")
							: t("domainValidation.recheck")}
					</Button>
				)
			}
		>
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
				<div className="space-y-6">
					{domainQuery.isLoading ? (
						<Card className="gap-0 rounded-lg py-0">
							<CardContent className="space-y-3 p-5">
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-2/3" />
							</CardContent>
						</Card>
					) : (
						<Card className="gap-0 rounded-lg py-0">
							<CardContent className="space-y-3 p-5">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="text-lg font-medium">
										{t("domainValidation.overallStatus")}
									</h2>
									{badge ? <ReadinessBadge readiness={{ badge }} /> : null}
								</div>
								{badge ? (
									<>
										<p className="font-medium">
											{t(`domainValidation.badges.${badge}.headline`)}
										</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											{t(`domainValidation.badges.${badge}.description`)}
										</p>
									</>
								) : (
									<p className="text-muted-foreground text-sm">
										{t("domainValidation.noRunYet")}
									</p>
								)}
								{selectedRun?.finishedAt ? (
									<p className="text-muted-foreground text-sm">
										{t("domainValidation.lastChecked", {
											time: formatValidationTimestamp(selectedRun.finishedAt),
										})}
									</p>
								) : null}
								<p className="text-muted-foreground border-t pt-3 text-sm">
									{t("domainValidation.advisoryNote")}
								</p>
							</CardContent>
						</Card>
					)}

					<section className="space-y-4">
						<div>
							<h2 className="text-lg font-medium">
								{t("domainValidation.checksTitle")}
							</h2>
							<p className="text-muted-foreground text-sm">
								{t("domainValidation.checksDescription")}
							</p>
						</div>

						{runQuery.isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 4 }).map((_, index) => (
									<Skeleton key={index} className="h-36 w-full rounded-lg" />
								))}
							</div>
						) : runQuery.isError ? (
							<Alert
								tone="destructive"
								title={t("domainValidation.runLoadError")}
							>
								<p>{getErrorMessage(runQuery.error)}</p>
							</Alert>
						) : selectedRun && domain?.domain ? (
							<div className="space-y-3">
								{sortChecks(selectedRun.checks ?? []).map((check) => (
									<ValidationCheckCard
										key={check.checkKey}
										check={check}
										domainName={domain.domain!}
									/>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">
								{t("domainValidation.selectRun")}
							</p>
						)}
					</section>

					<section className="space-y-4">
						<div>
							<h2 className="text-lg font-medium">
								{t("domainValidation.logsTitle")}
							</h2>
							<p className="text-muted-foreground text-sm">
								{t("domainValidation.logsDescription")}
							</p>
						</div>
						{runQuery.isLoading ? (
							<Skeleton className="h-40 w-full rounded-lg" />
						) : selectedRun ? (
							<ValidationLogs logs={selectedRun.logs ?? []} />
						) : null}
					</section>

					{recheckDomain.isError ? (
						<Alert
							tone="destructive"
							title={t("domainValidation.recheckFailed")}
						>
							<p>{getErrorMessage(recheckDomain.error)}</p>
						</Alert>
					) : null}
					{cancelValidation.isError ? (
						<Alert
							tone="destructive"
							title={t("domainValidation.cancelFailed")}
						>
							<p>{getErrorMessage(cancelValidation.error)}</p>
						</Alert>
					) : null}
				</div>

				<aside className="space-y-4">
					<div>
						<h2 className="text-lg font-medium">
							{t("domainValidation.historyTitle")}
						</h2>
						<p className="text-muted-foreground text-sm">
							{t("domainValidation.historyDescription")}
						</p>
					</div>

					{runsQuery.isLoading ? (
						<Skeleton className="h-48 w-full rounded-lg" />
					) : runsQuery.isError ? (
						<Alert
							tone="destructive"
							title={t("domainValidation.historyLoadError")}
						>
							<p>{getErrorMessage(runsQuery.error)}</p>
						</Alert>
					) : (
						<ValidationRunHistory
							runs={runs}
							selectedRunId={selectedRunId}
							onSelect={setSelectedRunId}
						/>
					)}

					{selectedRun ? (
						<Card className="gap-0 rounded-md py-0">
							<CardContent className="p-0">
								<dl className="text-muted-foreground space-y-2 p-4 text-sm">
									<div>
										<dt className="text-xs tracking-wide uppercase">
											{t("domainValidation.started")}
										</dt>
										<dd>{formatValidationTimestamp(selectedRun.startedAt)}</dd>
									</div>
									<div>
										<dt className="text-xs tracking-wide uppercase">
											{t("domainValidation.finished")}
										</dt>
										<dd>{formatValidationTimestamp(selectedRun.finishedAt)}</dd>
									</div>
									{selectedRun.receiveDeadlineAt ? (
										<div>
											<dt className="text-xs tracking-wide uppercase">
												{t("domainValidation.receiveDeadline")}
											</dt>
											<dd>
												{formatValidationTimestamp(selectedRun.receiveDeadlineAt)}
											</dd>
										</div>
									) : null}
								</dl>
							</CardContent>
						</Card>
					) : null}
				</aside>
			</div>
		</SettingsShell>
	);
}
