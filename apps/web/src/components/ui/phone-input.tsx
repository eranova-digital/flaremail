import * as React from "react";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import * as RPNInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import "react-phone-number-input/style.css";

type PhoneInputProps = Omit<
	React.ComponentProps<"input">,
	"onChange" | "value" | "ref"
> &
	Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & {
		onChange?: (value: RPNInput.Value) => void;
	};

const PhoneInput = React.forwardRef<
	React.ElementRef<typeof RPNInput.default>,
	PhoneInputProps
>(({ className, onChange, value, ...props }, ref) => {
	return (
		<RPNInput.default
			ref={ref}
			className={cn("flex", className)}
			flagComponent={FlagComponent}
			countrySelectComponent={CountrySelect}
			inputComponent={InputComponent}
			smartCaret={false}
			value={value || undefined}
			/**
			 * react-phone-number-input may call onChange with undefined when the
			 * number is incomplete. Coerce to empty string for controlled forms.
			 */
			onChange={(next) => onChange?.(next || ("" as RPNInput.Value))}
			{...props}
		/>
	);
});
PhoneInput.displayName = "PhoneInput";

const InputComponent = React.forwardRef<
	HTMLInputElement,
	React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
	<Input
		className={cn("rounded-e-lg rounded-s-none", className)}
		{...props}
		ref={ref}
	/>
));
InputComponent.displayName = "InputComponent";

type CountryEntry = { label: string; value: RPNInput.Country | undefined };

type CountrySelectProps = {
	disabled?: boolean;
	value: RPNInput.Country;
	options: CountryEntry[];
	onChange: (country: RPNInput.Country) => void;
};

const CountrySelect = ({
	disabled,
	value: selectedCountry,
	options: countryList,
	onChange,
}: CountrySelectProps) => {
	const scrollAreaRef = React.useRef<HTMLDivElement>(null);
	const [searchValue, setSearchValue] = React.useState("");
	const [isOpen, setIsOpen] = React.useState(false);

	return (
		<Popover
			open={isOpen}
			modal
			onOpenChange={(open) => {
				setIsOpen(open);
				if (open) {
					setSearchValue("");
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="flex gap-1 rounded-e-none rounded-s-lg border-r-0 px-3 focus:z-10"
					disabled={disabled}
				>
					<FlagComponent
						country={selectedCountry}
						countryName={selectedCountry}
					/>
					<ChevronsUpDown
						className={cn(
							"-mr-2 size-4 opacity-50",
							disabled ? "hidden" : "opacity-100",
						)}
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[min(300px,calc(100vw-2rem))] p-0">
				<Command>
					<CommandInput
						value={searchValue}
						onValueChange={(next) => {
							setSearchValue(next);
							setTimeout(() => {
								const viewportElement = scrollAreaRef.current?.querySelector(
									"[data-radix-scroll-area-viewport]",
								);
								if (viewportElement) {
									viewportElement.scrollTop = 0;
								}
							}, 0);
						}}
						placeholder="Search country..."
					/>
					<CommandList>
						<ScrollArea ref={scrollAreaRef} className="h-72">
							<CommandEmpty>No country found.</CommandEmpty>
							<CommandGroup>
								{countryList.map(({ value, label }) =>
									value ? (
										<CountrySelectOption
											key={value}
											country={value}
											countryName={label}
											selectedCountry={selectedCountry}
											onChange={onChange}
											onSelectComplete={() => setIsOpen(false)}
										/>
									) : null,
								)}
							</CommandGroup>
						</ScrollArea>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
};

type CountrySelectOptionProps = RPNInput.FlagProps & {
	selectedCountry: RPNInput.Country;
	onChange: (country: RPNInput.Country) => void;
	onSelectComplete: () => void;
};

const CountrySelectOption = ({
	country,
	countryName,
	selectedCountry,
	onChange,
	onSelectComplete,
}: CountrySelectOptionProps) => {
	const handleSelect = () => {
		onChange(country);
		onSelectComplete();
	};

	return (
		<CommandItem className="gap-2" onSelect={handleSelect}>
			<FlagComponent country={country} countryName={countryName} />
			<span className="flex-1 text-sm">{countryName}</span>
			<span className="text-foreground/50 text-sm">{`+${RPNInput.getCountryCallingCode(country)}`}</span>
			<CheckIcon
				className={cn(
					"ml-auto size-4",
					country === selectedCountry ? "opacity-100" : "opacity-0",
				)}
			/>
		</CommandItem>
	);
};

const FlagComponent = ({ country, countryName }: RPNInput.FlagProps) => {
	const Flag = flags[country];

	return (
		<span className="bg-foreground/20 flex h-4 w-6 overflow-hidden rounded-sm [&_svg:not([class*='size-'])]:size-full">
			{Flag ? <Flag title={countryName} /> : null}
		</span>
	);
};

export { PhoneInput };
