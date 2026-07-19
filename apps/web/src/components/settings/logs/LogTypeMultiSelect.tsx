import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOG_TYPES, type LogType } from "@/lib/logs/api";
import { cn } from "@/lib/utils";

type LogTypeMultiSelectProps = {
	value: LogType[];
	onChange: (types: LogType[]) => void;
	id?: string;
	className?: string;
};

export function LogTypeMultiSelect({
	value,
	onChange,
	id,
	className,
}: LogTypeMultiSelectProps) {
	const { t } = useTranslation("management");
	const selected = new Set(value);
	const label =
		value.length === 0
			? t("logs.types.all")
			: value.length <= 2
				? value.join(", ")
				: t("logs.types.count", { count: value.length });

	const toggle = (type: LogType, checked: boolean) => {
		if (checked) {
			onChange([...value, type].sort((a, b) =>
				LOG_TYPES.indexOf(a) - LOG_TYPES.indexOf(b),
			));
			return;
		}
		onChange(value.filter((item) => item !== type));
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					id={id}
					variant="outline"
					role="combobox"
					aria-label={t("logs.types.aria")}
					className={cn(
						"h-9 w-full justify-between font-normal",
						value.length === 0 && "text-muted-foreground",
						className,
					)}
				>
					<span className="truncate">{label}</span>
					<ChevronsUpDown className="text-muted-foreground size-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuLabel>{t("logs.types.label")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<button
					type="button"
					className="hover:bg-accent focus:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none"
					onClick={() => onChange([])}
				>
					<span
						className={cn(
							"flex size-3.5 items-center justify-center",
							value.length === 0 ? "opacity-100" : "opacity-0",
						)}
					>
						<Check className="size-3.5" />
					</span>
					{t("logs.types.all")}
				</button>
				<DropdownMenuSeparator />
				{LOG_TYPES.map((type) => (
					<DropdownMenuCheckboxItem
						key={type}
						checked={selected.has(type)}
						onCheckedChange={(checked) => toggle(type, Boolean(checked))}
						onSelect={(event) => event.preventDefault()}
					>
						{type}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
