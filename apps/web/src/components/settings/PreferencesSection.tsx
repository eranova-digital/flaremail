import { Monitor, Moon, Sun } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/lib/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme-preference";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: {
	value: ThemePreference;
	label: string;
	description: string;
	icon: typeof Sun;
}[] = [
	{
		value: "light",
		label: "Light",
		description: "Always use the light appearance.",
		icon: Sun,
	},
	{
		value: "dark",
		label: "Dark",
		description: "Always use the dark appearance.",
		icon: Moon,
	},
	{
		value: "system",
		label: "System",
		description: "Match your operating system setting.",
		icon: Monitor,
	},
];

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
	const { preference, setPreference } = useTheme();

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">Preferences</h2>
				<p className="text-muted-foreground max-w-prose text-sm">
					Customize how Flaremail looks and feels on this device. These settings
					stay in your browser and are not synced to your account.
				</p>
			</div>

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="text-base">Appearance</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">
						Choose a theme for the web app.
					</p>
					<div
						className="space-y-2"
						role="radiogroup"
						aria-label="Theme"
					>
						{THEME_OPTIONS.map((option) => (
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
