import { useTranslation } from "react-i18next";

export function EmptyReadingPane() {
	const { t } = useTranslation("mail");

	return (
		<div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm sm:p-8">
			{t("empty.readingPane")}
		</div>
	);
}
