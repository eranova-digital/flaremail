import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation("settings");
	const { t: tc } = useTranslation("common");
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
		<Card className="rounded-xl shadow-sm">
			<CardHeader className="pb-4">
				<CardTitle className="text-base">{t("connectedApps.title")}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-muted-foreground text-sm">
					{t("connectedApps.description")}
				</p>
				{error ? <Alert tone="destructive">{error}</Alert> : null}
				{loading ? (
					<p className="text-muted-foreground flex items-center gap-2 text-sm">
						<Loader2 className="size-4 animate-spin" />
						{tc("loading")}
					</p>
				) : grants.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("connectedApps.empty")}</p>
				) : (
					<div className="space-y-2">
						{grants.map((grant) => (
							<div key={grant.id} className="rounded-lg border">
								<div className="flex flex-row items-start justify-between gap-3 px-4 pt-3 pb-2">
									<div>
										<p className="text-sm font-semibold">{grant.clientName}</p>
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
										{t("connectedApps.revoke")}
									</Button>
								</div>
								<p className="text-muted-foreground px-4 pb-3 text-sm">
									{t("connectedApps.scopes", {
										scopes: grant.scopes.join(" "),
									})}
								</p>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
