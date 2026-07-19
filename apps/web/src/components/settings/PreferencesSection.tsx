import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme-preference";
import { cn } from "@/lib/utils";
import {
	LOCALE_FLAGS,
	LOCALE_LABELS,
	SUPPORTED_LOCALES,
	isAppLocale,
} from "@test-worker/i18n";

function ThemeOption({
	value,
	currentValue,
	label,
	description,
	icon: Icon,
	onChange,
}: {
	value: ThemePreference;
	currentValue: ThemePreference;
	label: string;
	description: string;
	icon: typeof Sun;
	onChange: (value: ThemePreference) => void;
}) {
	const selected = value === currentValue;

	return (
		<label
			className={cn(
				"flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors",
				selected && "border-primary bg-primary/5",
			)}
		>
			<input
				type="radio"
				name="theme-preference"
				value={value}
				checked={selected}
				onChange={() => onChange(value)}
				className="mt-1"
			/>
			<span className="flex min-w-0 flex-1 items-start gap-3">
				<Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
				<span className="space-y-1">
					<span className="block text-sm font-medium">{label}</span>
					<span className="text-muted-foreground block text-xs">
						{description}
					</span>
				</span>
			</span>
		</label>
	);
}

export function PreferencesSection() {
	const { t } = useTranslation("settings");
	const { preference, setPreference } = useTheme();
	const { locale, setLocale } = useLocale();

	const themeOptions: {
		value: ThemePreference;
		label: string;
		description: string;
		icon: typeof Sun;
	}[] = [
		{
			value: "light",
			label: t("preferences.theme.light.label"),
			description: t("preferences.theme.light.description"),
			icon: Sun,
		},
		{
			value: "dark",
			label: t("preferences.theme.dark.label"),
			description: t("preferences.theme.dark.description"),
			icon: Moon,
		},
		{
			value: "system",
			label: t("preferences.theme.system.label"),
			description: t("preferences.theme.system.description"),
			icon: Monitor,
		},
	];

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">{t("preferences.title")}</h2>
				<p className="text-muted-foreground max-w-prose text-sm">
					{t("preferences.description")}
				</p>
			</div>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">
						{t("preferences.language.title")}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">
						{t("preferences.language.description")}
					</p>
					<Select
						value={locale}
						onValueChange={(value) => {
							if (isAppLocale(value)) {
								setLocale(value);
							}
						}}
					>
						<SelectTrigger
							className="max-w-sm"
							aria-label={t("preferences.language.title")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SUPPORTED_LOCALES.map((value) => (
								<SelectItem key={value} value={value}>
									<span className="flex items-center gap-2">
										<span className="text-base leading-none" aria-hidden>
											{LOCALE_FLAGS[value]}
										</span>
										<span>{LOCALE_LABELS[value]}</span>
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">
						{t("preferences.appearance.title")}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">
						{t("preferences.appearance.description")}
					</p>
					<div
						className="space-y-2"
						role="radiogroup"
						aria-label={t("preferences.appearance.title")}
					>
						{themeOptions.map((option) => (
							<ThemeOption
								key={option.value}
								value={option.value}
								currentValue={preference}
								label={option.label}
								description={option.description}
								icon={option.icon}
								onChange={setPreference}
							/>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
