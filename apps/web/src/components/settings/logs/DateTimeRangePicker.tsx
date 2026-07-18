import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateTimeRangeValue = {
	from?: Date;
	to?: Date;
};

type DateTimeRangePickerProps = {
	value?: DateTimeRangeValue;
	onChange: (value: DateTimeRangeValue | undefined) => void;
	id?: string;
	className?: string;
	placeholder?: string;
};

function timeInputValue(date: Date | undefined, fallback: string): string {
	if (!date) return fallback;
	return format(date, "HH:mm:ss");
}

function withTime(date: Date, time: string): Date {
	const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
	const next = new Date(date);
	next.setHours(hours || 0, minutes || 0, seconds || 0, 0);
	return next;
}

function formatRangeLabel(value: DateTimeRangeValue | undefined): string | null {
	if (!value?.from) return null;
	if (value.to) {
		return `${format(value.from, "MMM d, yyyy HH:mm")} – ${format(value.to, "MMM d, yyyy HH:mm")}`;
	}
	return `${format(value.from, "MMM d, yyyy HH:mm")} – …`;
}

export function DateTimeRangePicker({
	value,
	onChange,
	id,
	className,
	placeholder = "Pick a date & time range",
}: DateTimeRangePickerProps) {
	const [open, setOpen] = useState(false);

	const selected: DateRange | undefined = useMemo(() => {
		if (!value?.from) return undefined;
		return { from: value.from, to: value.to };
	}, [value?.from, value?.to]);

	const fromTime = timeInputValue(value?.from, "00:00:00");
	const toTime = timeInputValue(value?.to, "23:59:59");
	const label = formatRangeLabel(value);

	const handleSelect = (range: DateRange | undefined) => {
		if (!range?.from) {
			onChange(undefined);
			return;
		}
		const from = withTime(range.from, value?.from ? fromTime : "00:00:00");
		const to = range.to
			? withTime(range.to, value?.to ? toTime : "23:59:59")
			: undefined;
		onChange({ from, to });
	};

	const handleFromTime = (time: string) => {
		if (!value?.from) return;
		onChange({
			from: withTime(value.from, time),
			to: value.to,
		});
	};

	const handleToTime = (time: string) => {
		if (!value?.to) return;
		onChange({
			from: value.from,
			to: withTime(value.to, time),
		});
	};

	const clear = () => {
		onChange(undefined);
	};

	return (
		<div className={cn("flex gap-1", className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						id={id}
						variant="outline"
						aria-label="Date and time range"
						className={cn(
							"h-9 min-w-0 flex-1 justify-start gap-2 px-3 font-normal",
							!label && "text-muted-foreground",
						)}
					>
						<CalendarIcon className="size-4 shrink-0 opacity-70" />
						<span className="truncate">{label ?? placeholder}</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="range"
						numberOfMonths={2}
						selected={selected}
						onSelect={handleSelect}
						defaultMonth={value?.from}
					/>
					<div className="grid gap-3 border-t p-3 sm:grid-cols-2">
						<div className="space-y-1.5">
							<label
								htmlFor={`${id ?? "range"}-from-time`}
								className="text-muted-foreground text-xs"
							>
								From time
							</label>
							<Input
								id={`${id ?? "range"}-from-time`}
								type="time"
								step={1}
								value={fromTime}
								disabled={!value?.from}
								onChange={(event) => handleFromTime(event.target.value)}
								className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
							/>
						</div>
						<div className="space-y-1.5">
							<label
								htmlFor={`${id ?? "range"}-to-time`}
								className="text-muted-foreground text-xs"
							>
								To time
							</label>
							<Input
								id={`${id ?? "range"}-to-time`}
								type="time"
								step={1}
								value={toTime}
								disabled={!value?.to}
								onChange={(event) => handleToTime(event.target.value)}
								className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
							/>
						</div>
					</div>
				</PopoverContent>
			</Popover>
			{value?.from ? (
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-9 shrink-0"
					aria-label="Clear date range"
					onClick={clear}
				>
					<XIcon className="size-4" />
				</Button>
			) : null}
		</div>
	);
}
