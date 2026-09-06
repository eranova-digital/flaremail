import * as React from "react";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as RPNInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import de from "react-phone-number-input/locale/de.json";
import en from "react-phone-number-input/locale/en.json";
import es from "react-phone-number-input/locale/es.json";
import fr from "react-phone-number-input/locale/fr.json";
import it from "react-phone-number-input/locale/it.json";
import ja from "react-phone-number-input/locale/ja.json";
import ko from "react-phone-number-input/locale/ko.json";
import pl from "react-phone-number-input/locale/pl.json";
import ptBR from "react-phone-number-input/locale/pt-BR.json";
import ru from "react-phone-number-input/locale/ru.json";
import tr from "react-phone-number-input/locale/tr.json";
import zh from "react-phone-number-input/locale/zh.json";
import { isAppLocale, type AppLocale } from "@flaremail/i18n";

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

const PHONE_COUNTRY_LABELS: Record<AppLocale, typeof en> = {
	"en-US": en,
	"ro-RO": en,
	"es-ES": es,
	"de-DE": de,
	"fr-FR": fr,
	"pt-BR": ptBR,
	"it-IT": it,
	"pl-PL": pl,
	"tr-TR": tr,
	"ja-JP": ja,
	"ko-KR": ko,
	"zh-CN": zh,
	"ru-RU": ru,
};

function phoneCountryLabels(language: string): typeof en {
	return isAppLocale(language) ? PHONE_COUNTRY_LABELS[language] : en;
}

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
	const { i18n } = useTranslation("settings");

	return (
		<RPNInput.default
			ref={ref}
			className={cn("flex", className)}
			flagComponent={FlagComponent}
			countrySelectComponent={CountrySelect}
			inputComponent={InputComponent}
			labels={phoneCountryLabels(i18n.language)}
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
	const { t } = useTranslation("settings");

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
						placeholder={t("profile.fields.searchCountry")}
					/>
					<CommandList>
						<ScrollArea ref={scrollAreaRef} className="h-72">
							<CommandEmpty>{t("profile.fields.noCountryFound")}</CommandEmpty>
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
