import { useTranslation } from "react-i18next";

import { PageLoader } from "@/components/PageLoader";

/** Dev-only route to preview the full-page loader indefinitely. */
export function LoadingPage() {
	const { t } = useTranslation("auth");
	return <PageLoader label={t("loading")} />;
}
