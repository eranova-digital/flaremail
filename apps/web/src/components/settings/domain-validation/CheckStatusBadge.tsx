import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";

export function CheckStatusBadge({
	status,
	tier,
}: {
	status?: string;
	tier?: string;
}) {
	const { t } = useTranslation("management");

	if (status === "passed") {
		return <Badge variant="default">{t("domainValidation.status.passed")}</Badge>;
	}
	if (status === "failed") {
		return (
			<Badge variant={tier === "advisory" ? "secondary" : "outline"}>
				{tier === "advisory"
					? t("domainValidation.status.advisoryFail")
					: t("domainValidation.status.failed")}
			</Badge>
		);
	}
	if (status === "skipped") {
		return <Badge variant="secondary">{t("domainValidation.status.skipped")}</Badge>;
	}
	return <Badge variant="outline">{t("domainValidation.status.pending")}</Badge>;
}
