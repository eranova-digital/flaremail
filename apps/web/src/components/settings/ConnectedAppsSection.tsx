import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api/errors";
import {
	listMyOidcGrants,
	revokeMyOidcGrant,
	type OidcConsentGrant,
} from "@/lib/oidc/api";

export function ConnectedAppsSection() {
	const [grants, setGrants] = useState<OidcConsentGrant[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [revoking, setRevoking] = useState<string | null>(null);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await listMyOidcGrants();
			setGrants(result.grants);
		} catch (loadError) {
			setError(getErrorMessage(loadError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const handleRevoke = async (clientId: string) => {
		setRevoking(clientId);
		setError(null);
		try {
			await revokeMyOidcGrant(clientId);
			await reload();
		} catch (revokeError) {
			setError(getErrorMessage(revokeError));
		} finally {
			setRevoking(null);
		}
	};

	return (
		<div className="space-y-3">
			<div>
				<h3 className="text-base font-semibold">Connected apps</h3>
				<p className="text-muted-foreground text-sm">
					OIDC clients you have authorized. Revoking signs them out of refresh
					access until you consent again.
				</p>
			</div>
			{error ? <Alert tone="destructive">{error}</Alert> : null}
			{loading ? (
				<p className="text-muted-foreground flex items-center gap-2 text-sm">
					<Loader2 className="size-4 animate-spin" />
					Loading…
				</p>
			) : grants.length === 0 ? (
				<p className="text-muted-foreground text-sm">No connected apps.</p>
			) : (
				<div className="space-y-2">
					{grants.map((grant) => (
						<Card key={grant.id}>
							<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
								<div>
									<CardTitle className="text-base">{grant.clientName}</CardTitle>
									<p className="text-muted-foreground mt-1 font-mono text-xs">
										{grant.clientId}
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={revoking === grant.clientId}
									onClick={() => void handleRevoke(grant.clientId)}
								>
									{revoking === grant.clientId ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									Revoke
								</Button>
							</CardHeader>
							<CardContent className="text-muted-foreground text-sm">
								Scopes: {grant.scopes.join(" ")}
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
