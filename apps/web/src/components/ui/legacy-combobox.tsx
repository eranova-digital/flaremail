import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
	value: string;
	label: string;
};

type LegacyComboboxProps = {
	id?: string;
	options: ComboboxOption[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
	allowCustom?: boolean;
	customOptionLabel?: (query: string) => string;
};

export function LegacyCombobox({
	id,
	options,
	value,
	onValueChange,
	placeholder = "Select…",
	searchPlaceholder = "Search…",
	emptyText = "No results found.",
	disabled = false,
	className,
	allowCustom = false,
	customOptionLabel = (query) => `Use "${query}"`,
}: LegacyComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const selected = options.find((option) => option.value === value);
	const displayLabel = selected?.label ?? value;
	const hasValue = Boolean(displayLabel);
	const trimmedSearch = search.trim();
	const matchesExistingOption = options.some(
		(option) =>
			option.value === trimmedSearch ||
			option.label.toLowerCase() === trimmedSearch.toLowerCase(),
	);
	const showCustomOption = allowCustom && trimmedSearch && !matchesExistingOption;

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) {
					setSearch("");
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button
					id={id}
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						"w-full justify-between font-normal",
						!hasValue && "text-muted-foreground",
						className,
					)}
				>
					<span className="truncate">{displayLabel || placeholder}</span>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
				<Command>
					<CommandInput
						placeholder={searchPlaceholder}
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						<CommandEmpty>{emptyText}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem
									key={option.value}
									value={option.label}
									onSelect={() => {
										onValueChange(option.value === value ? "" : option.value);
										setOpen(false);
										setSearch("");
									}}
								>
									<Check
										className={cn(
											"size-4",
											value === option.value ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="truncate">{option.label}</span>
								</CommandItem>
							))}
							{showCustomOption ? (
								<CommandItem
									key={`custom-${trimmedSearch}`}
									value={trimmedSearch}
									onSelect={() => {
										onValueChange(trimmedSearch);
										setOpen(false);
										setSearch("");
									}}
								>
									<Check
										className={cn(
											"size-4",
											value === trimmedSearch ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="truncate">{customOptionLabel(trimmedSearch)}</span>
								</CommandItem>
							) : null}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
