import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";

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
	useDomain,
	useDomainValidationRun,
	useDomainValidationRuns,
	useRecheckDomain,
} from "@/hooks/use-domain-validation";
import { getErrorMessage } from "@/lib/api/errors";
import {
	BADGE_META,
	formatValidationTimestamp,
	sortChecks,
} from "@/lib/domain-validation";
import { canAccessDomainsTab } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

export function DomainValidationPage() {
	const { domainId } = useParams();
	const { account } = useAuth();
	const canAccess = canAccessDomainsTab(account);
	const domainQuery = useDomain(domainId, canAccess);
	const runsQuery = useDomainValidationRuns(domainId, canAccess && domainQuery.isSuccess);
	const recheckDomain = useRecheckDomain();
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
	const badgeMeta = badge ? BADGE_META[badge] : null;
	const isChecking = badge === "checking" || selectedRun?.status === "checking";
	const isPending = recheckDomain.isPending;

	if (!domainId || !canAccess) {
		return <Navigate to="/management?tab=domains" replace />;
	}

	if (domainQuery.isError) {
		return (
			<SettingsShell
				rootLabel="Management"
				rootTo="/management"
				crumbs={[
					{ label: "Domains", to: "/management?tab=domains" },
					{ label: "Domain readiness" },
				]}
				backTo="/management?tab=domains"
				backLabel="Back to domains"
			>
				<Alert tone="warning" title="This domain is unavailable to your account">
					<p>{getErrorMessage(domainQuery.error)}</p>
				</Alert>
			</SettingsShell>
		);
	}

	return (
		<SettingsShell
			rootLabel="Management"
			rootTo="/management"
			crumbs={[
				{ label: "Domains", to: "/management?tab=domains" },
				{ label: domain?.domain ?? "Domain readiness" },
			]}
			backTo="/management?tab=domains"
			backLabel="Back to domains"
			widthClassName="max-w-5xl"
			actions={
				<Button
					variant="outline"
					size="sm"
					onClick={() => recheckDomain.mutate(domainId)}
					disabled={isPending || isChecking || domainQuery.isLoading}
				>
					<RefreshCw className={cn("size-4", isChecking && "animate-spin")} />
					{isChecking ? "Checking…" : "Recheck"}
				</Button>
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
									<h2 className="text-lg font-medium">Overall status</h2>
									{badge ? <ReadinessBadge readiness={{ badge }} /> : null}
								</div>
								{badgeMeta ? (
									<>
										<p className="font-medium">{badgeMeta.headline}</p>
										<p className="text-muted-foreground text-sm leading-relaxed">
											{badgeMeta.description}
										</p>
									</>
								) : (
									<p className="text-muted-foreground text-sm">
										No validation run yet. Click Recheck to start one.
									</p>
								)}
								{selectedRun?.finishedAt ? (
									<p className="text-muted-foreground text-sm">
										Last checked {formatValidationTimestamp(selectedRun.finishedAt)}
									</p>
								) : null}
								<p className="text-muted-foreground border-t pt-3 text-sm">
									Readiness is advisory only. It does not block sending,
									receiving, or mailbox management for this domain.
								</p>
							</CardContent>
						</Card>
					)}

					<section className="space-y-4">
						<div>
							<h2 className="text-lg font-medium">Checks</h2>
							<p className="text-muted-foreground text-sm">
								Required checks must pass for a healthy mail flow. Advisory
								checks are recommendations only.
							</p>
						</div>

						{runQuery.isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 4 }).map((_, index) => (
									<Skeleton key={index} className="h-36 w-full rounded-lg" />
								))}
							</div>
						) : runQuery.isError ? (
							<Alert tone="destructive" title="Couldn't load this run">
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
								Select a validation run from the history to view check details.
							</p>
						)}
					</section>

					<section className="space-y-4">
						<div>
							<h2 className="text-lg font-medium">Logs</h2>
							<p className="text-muted-foreground text-sm">
								Worker events recorded during the selected run.
							</p>
						</div>
						{runQuery.isLoading ? (
							<Skeleton className="h-40 w-full rounded-lg" />
						) : selectedRun ? (
							<ValidationLogs logs={selectedRun.logs ?? []} />
						) : null}
					</section>

					{recheckDomain.isError ? (
						<Alert tone="destructive" title="Recheck failed">
							<p>{getErrorMessage(recheckDomain.error)}</p>
						</Alert>
					) : null}
				</div>

				<aside className="space-y-4">
					<div>
						<h2 className="text-lg font-medium">Run history</h2>
						<p className="text-muted-foreground text-sm">
							Earlier runs stay available for comparison.
						</p>
					</div>

					{runsQuery.isLoading ? (
						<Skeleton className="h-48 w-full rounded-lg" />
					) : runsQuery.isError ? (
						<Alert tone="destructive" title="Couldn't load run history">
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
										<dt className="text-xs tracking-wide uppercase">Started</dt>
										<dd>{formatValidationTimestamp(selectedRun.startedAt)}</dd>
									</div>
									<div>
										<dt className="text-xs tracking-wide uppercase">Finished</dt>
										<dd>{formatValidationTimestamp(selectedRun.finishedAt)}</dd>
									</div>
									{selectedRun.receiveDeadlineAt ? (
										<div>
											<dt className="text-xs tracking-wide uppercase">
												Receive deadline
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
