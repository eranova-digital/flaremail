import { Trans, useTranslation } from "react-i18next";

type ConfigErrorScreenProps = {
	message: string;
};

export function ConfigErrorScreen({ message }: ConfigErrorScreenProps) {
	const { t } = useTranslation("auth");

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-3 p-8 text-center">
			<h1 className="text-xl font-semibold">{t("configError.title")}</h1>
			<p className="text-muted-foreground max-w-md text-sm">{message}</p>
			<p className="text-muted-foreground max-w-md text-xs">
				<Trans
					i18nKey="configError.hint"
					ns="auth"
					values={{
						example: "apps/web/.env.example",
						env: "apps/web/.env",
						apiUrl: "API_URL",
					}}
					components={{
						example: <code className="font-mono" />,
						env: <code className="font-mono" />,
						apiUrl: <code className="font-mono" />,
					}}
				/>
			</p>
		</div>
	);
}
