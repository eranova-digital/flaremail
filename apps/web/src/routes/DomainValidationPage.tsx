import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { ReadinessBadge } from "@/components/settings/domain-validation/ReadinessBadge";
import { ValidationCheckCard } from "@/components/settings/domain-validation/ValidationCheckCard";
import { ValidationLogs } from "@/components/settings/domain-validation/ValidationLogs";
import { ValidationRunHistory } from "@/components/settings/domain-validation/ValidationRunHistory";
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
		return <Navigate to="/settings?tab=domains" replace />;
	}

	if (domainQuery.isError) {
		return (
			<div className="bg-background min-h-svh">
				<header className="border-b">
					<div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
						<Button variant="ghost" size="icon" asChild>
							<Link to="/settings?tab=domains" aria-label="Back to domains">
								<ArrowLeft className="size-4" />
							</Link>
						</Button>
						<h1 className="text-xl font-semibold tracking-tight">Domain unavailable</h1>
					</div>
				</header>
				<main className="mx-auto max-w-3xl px-6 py-8">
					<Card>
						<CardContent className="space-y-2">
							<p className="font-medium">This domain is unavailable to your account.</p>
							<p className="text-muted-foreground text-sm">
								{getErrorMessage(domainQuery.error)}
							</p>
						</CardContent>
					</Card>
				</main>
			</div>
		);
	}

	return (
		<div className="bg-background min-h-svh">
			<header className="border-b">
				<div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
					<Button variant="ghost" size="icon" asChild>
						<Link to="/settings?tab=domains" aria-label="Back to domains">
							<ArrowLeft className="size-4" />
						</Link>
					</Button>
					<div className="min-w-0 flex-1">
						<p className="text-muted-foreground text-sm">Domain readiness</p>
						<h1 className="truncate text-xl font-semibold tracking-tight">
							{domain?.domain ?? "Loading…"}
						</h1>
					</div>
					<Button
						variant="outline"
						onClick={() => recheckDomain.mutate(domainId)}
						disabled={isPending || isChecking || domainQuery.isLoading}
					>
						<RefreshCw className={cn("mr-2 size-4", isChecking && "animate-spin")} />
						Recheck
					</Button>
				</div>
			</header>

			<main className="mx-auto grid max-w-5xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
				<div className="space-y-6">
					{domainQuery.isLoading ? (
						<Skeleton className="h-32 w-full" />
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
									No validation run yet. Add the domain or click Recheck to start one.
								</p>
							)}
							<p className="text-muted-foreground border-t pt-3 text-sm">
								Readiness is advisory only. It does not block sending, receiving, or
								mailbox management for this domain.
							</p>
							</CardContent>
						</Card>
					)}

					<section className="space-y-4">
						<div>
							<h2 className="text-lg font-medium">Checks</h2>
							<p className="text-muted-foreground text-sm">
								Required checks must pass for a healthy mail flow. Advisory checks are
								recommendations only.
							</p>
						</div>

						{runQuery.isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 4 }).map((_, index) => (
									<Skeleton key={index} className="h-36 w-full" />
								))}
							</div>
						) : runQuery.isError ? (
							<p className="text-destructive text-sm">
								{getErrorMessage(runQuery.error)}
							</p>
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
							<Skeleton className="h-40 w-full" />
						) : selectedRun ? (
							<ValidationLogs logs={selectedRun.logs ?? []} />
						) : null}
					</section>

					{recheckDomain.isError ? (
						<p className="text-destructive text-sm">
							{getErrorMessage(recheckDomain.error)}
						</p>
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
						<Skeleton className="h-48 w-full" />
					) : runsQuery.isError ? (
						<p className="text-destructive text-sm">
							{getErrorMessage(runsQuery.error)}
						</p>
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
								<dt className="text-xs uppercase tracking-wide">Started</dt>
								<dd>{formatValidationTimestamp(selectedRun.startedAt)}</dd>
							</div>
							<div>
								<dt className="text-xs uppercase tracking-wide">Finished</dt>
								<dd>{formatValidationTimestamp(selectedRun.finishedAt)}</dd>
							</div>
							{selectedRun.receiveDeadlineAt ? (
								<div>
									<dt className="text-xs uppercase tracking-wide">Receive deadline</dt>
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
			</main>
		</div>
	);
}
