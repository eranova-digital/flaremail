import { useEffect, useMemo, useState, type ReactNode } from "react";
import Country from "country-state-city/lib/country.js";
import State from "country-state-city/lib/state.js";
import type { ICity } from "country-state-city";
import { useTranslation } from "react-i18next";

import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
	LegacyCombobox,
	type ComboboxOption,
} from "@/components/ui/legacy-combobox";
import type { ProfileFieldKey } from "@/lib/accounts/api";

type AddressLocationFieldsProps = {
	values: Record<string, string>;
	onChange: (key: ProfileFieldKey, value: string) => void;
	idPrefix: string;
	disabled?: boolean;
	isFieldDisabled?: (key: ProfileFieldKey) => boolean;
	labelExtra?: (key: ProfileFieldKey) => ReactNode;
	inputExtra?: (key: ProfileFieldKey) => ReactNode;
	requiredFields?: ReadonlySet<string>;
	hiddenFields?: ReadonlySet<string>;
};

const COUNTRIES = Country.getAllCountries();

function findCountry(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const lower = trimmed.toLowerCase();
	return (
		COUNTRIES.find((country) => country.name === trimmed) ??
		COUNTRIES.find((country) => country.isoCode.toLowerCase() === lower) ??
		COUNTRIES.find((country) => country.name.toLowerCase() === lower)
	);
}

function findState(countryCode: string, value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const states = State.getStatesOfCountry(countryCode);
	const lower = trimmed.toLowerCase();
	return (
		states.find((state) => state.name === trimmed) ??
		states.find((state) => state.isoCode.toLowerCase() === lower) ??
		states.find((state) => state.name.toLowerCase() === lower)
	);
}

function withCurrentOption(
	options: ComboboxOption[],
	current: string,
): ComboboxOption[] {
	const trimmed = current.trim();
	if (!trimmed) {
		return options;
	}
	const lower = trimmed.toLowerCase();
	const exists = options.some(
		(option) =>
			option.value === trimmed ||
			option.label.toLowerCase() === lower ||
			option.value.toLowerCase() === lower,
	);
	if (exists) {
		return options;
	}
	return [{ value: trimmed, label: trimmed }, ...options];
}

function FieldShell({
	inputId,
	label,
	isRequired,
	labelExtra,
	children,
}: {
	inputId: string;
	label: string;
	isRequired: boolean;
	labelExtra?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="space-y-1">
			<div className="flex min-h-5 items-center justify-between gap-2">
				<label htmlFor={inputId} className="text-sm font-medium">
					{label}
					{isRequired ? <span className="text-destructive ml-1">*</span> : null}
				</label>
				{labelExtra}
			</div>
			{children}
		</div>
	);
}

function LocationControl({
	inputId,
	value,
	options,
	onValueChange,
	disabled,
	required,
	placeholder,
	searchPlaceholder,
	emptyText,
	trailing,
	fallbackInput = false,
	autoComplete,
}: {
	inputId: string;
	value: string;
	options: ComboboxOption[];
	onValueChange: (value: string) => void;
	disabled: boolean;
	required: boolean;
	placeholder: string;
	searchPlaceholder: string;
	emptyText: string;
	trailing?: ReactNode;
	fallbackInput?: boolean;
	autoComplete?: string;
}) {
	if (fallbackInput) {
		const input = (
			<Input
				id={inputId}
				type="text"
				value={value}
				autoComplete={autoComplete}
				onChange={(event) => onValueChange(event.target.value)}
				disabled={disabled}
				required={required}
			/>
		);
		if (!trailing) {
			return input;
		}
		return (
			<InputGroup>
				<InputGroupInput
					id={inputId}
					value={value}
					autoComplete={autoComplete}
					onChange={(event) => onValueChange(event.target.value)}
					disabled={disabled}
					required={required}
				/>
				<InputGroupAddon align="inline-end">{trailing}</InputGroupAddon>
			</InputGroup>
		);
	}

	const combobox = (
		<>
			<LegacyCombobox
				id={inputId}
				value={value}
				onValueChange={onValueChange}
				options={options}
				placeholder={placeholder}
				searchPlaceholder={searchPlaceholder}
				emptyText={emptyText}
				disabled={disabled}
				className="h-9"
			/>
			{required ? (
				<input
					tabIndex={-1}
					aria-hidden
					className="sr-only"
					value={value}
					required
					readOnly
				/>
			) : null}
		</>
	);

	if (!trailing) {
		return combobox;
	}

	return (
		<div className="flex items-center gap-1">
			<div className="min-w-0 flex-1">{combobox}</div>
			{trailing}
		</div>
	);
}

export function AddressLocationFields({
	values,
	onChange,
	idPrefix,
	disabled = false,
	isFieldDisabled,
	labelExtra,
	inputExtra,
	requiredFields,
	hiddenFields,
}: AddressLocationFieldsProps) {
	const { t } = useTranslation("settings");

	const countryValue = values.addressCountry ?? "";
	const stateValue = values.addressState ?? "";
	const cityValue = values.addressCity ?? "";

	const matchedCountry = useMemo(() => findCountry(countryValue), [countryValue]);
	const countryCode = matchedCountry?.isoCode;

	const states = useMemo(
		() => (countryCode ? State.getStatesOfCountry(countryCode) : []),
		[countryCode],
	);
	const hasStates = states.length > 0;
	const matchedState = useMemo(
		() => (countryCode ? findState(countryCode, stateValue) : undefined),
		[countryCode, stateValue],
	);
	const stateCode = matchedState?.isoCode;

	const [cities, setCities] = useState<ICity[]>([]);
	const [citiesLoading, setCitiesLoading] = useState(false);

	const canLoadCities =
		Boolean(countryCode) && (!hasStates || Boolean(stateCode));

	useEffect(() => {
		let cancelled = false;

		async function loadCities() {
			if (!canLoadCities || !countryCode) {
				setCities([]);
				setCitiesLoading(false);
				return;
			}

			setCitiesLoading(true);
			try {
				const { default: City } = await import(
					"country-state-city/lib/city.js"
				);
				if (cancelled) {
					return;
				}
				const next = hasStates
					? City.getCitiesOfState(countryCode, stateCode!)
					: (City.getCitiesOfCountry(countryCode) ?? []);
				setCities(next);
			} finally {
				if (!cancelled) {
					setCitiesLoading(false);
				}
			}
		}

		void loadCities();
		return () => {
			cancelled = true;
		};
	}, [canLoadCities, countryCode, hasStates, stateCode]);

	const countryOptions = useMemo(
		() =>
			withCurrentOption(
				COUNTRIES.map((country) => ({
					value: country.name,
					label: country.name,
				})),
				countryValue,
			),
		[countryValue],
	);

	const stateOptions = useMemo(
		() =>
			withCurrentOption(
				states.map((state) => ({
					value: state.name,
					label: state.name,
				})),
				stateValue,
			),
		[states, stateValue],
	);

	const cityOptions = useMemo(
		() =>
			withCurrentOption(
				cities.map((city) => ({
					value: city.name,
					label: city.name,
				})),
				cityValue,
			),
		[cities, cityValue],
	);

	/** Dataset has no cities for this place — keep free-form so users aren't stuck. */
	const cityNeedsFallback =
		canLoadCities && !citiesLoading && cities.length === 0;

	const setCountry = (next: string) => {
		onChange("addressCountry", next);
		if (next !== countryValue) {
			onChange("addressState", "");
			onChange("addressCity", "");
		}
	};

	const setState = (next: string) => {
		onChange("addressState", next);
		if (next !== stateValue) {
			onChange("addressCity", "");
		}
	};

	const fieldMeta = (key: ProfileFieldKey) => {
		const hidden = hiddenFields?.has(key) ?? false;
		const isRequired = requiredFields?.has(key) ?? false;
		const isInputDisabled = disabled || (isFieldDisabled?.(key) ?? false);
		return {
			hidden,
			isRequired,
			isInputDisabled,
			inputId: `${idPrefix}-${key}`,
			label: t(`profile.fields.${key}`),
			extra: labelExtra?.(key),
			trailing: inputExtra?.(key),
		};
	};

	const country = fieldMeta("addressCountry");
	const state = fieldMeta("addressState");
	const city = fieldMeta("addressCity");

	const searchPlaceholder = t("profile.fields.locationSearchPlaceholder");
	const emptyText = t("profile.fields.locationEmpty");

	return (
		<div className="grid gap-3 sm:grid-cols-3">
			{country.hidden ? null : (
				<FieldShell
					inputId={country.inputId}
					label={country.label}
					isRequired={country.isRequired}
					labelExtra={country.extra}
				>
					<LocationControl
						inputId={country.inputId}
						value={countryValue}
						options={countryOptions}
						onValueChange={setCountry}
						disabled={country.isInputDisabled}
						required={country.isRequired}
						placeholder={t("profile.fields.selectCountry")}
						searchPlaceholder={searchPlaceholder}
						emptyText={emptyText}
						trailing={country.trailing}
						autoComplete="country-name"
					/>
				</FieldShell>
			)}
			{state.hidden ? null : (
				<FieldShell
					inputId={state.inputId}
					label={state.label}
					isRequired={state.isRequired}
					labelExtra={state.extra}
				>
					<LocationControl
						inputId={state.inputId}
						value={stateValue}
						options={stateOptions}
						onValueChange={setState}
						disabled={
							state.isInputDisabled || !countryCode || !hasStates
						}
						required={state.isRequired && hasStates}
						placeholder={t("profile.fields.selectState")}
						searchPlaceholder={searchPlaceholder}
						emptyText={emptyText}
						trailing={state.trailing}
						autoComplete="address-level1"
					/>
				</FieldShell>
			)}
			{city.hidden ? null : (
				<FieldShell
					inputId={city.inputId}
					label={city.label}
					isRequired={city.isRequired}
					labelExtra={city.extra}
				>
					<LocationControl
						inputId={city.inputId}
						value={cityValue}
						options={cityOptions}
						onValueChange={(next) => onChange("addressCity", next)}
						disabled={
							city.isInputDisabled ||
							!canLoadCities ||
							citiesLoading
						}
						required={city.isRequired}
						placeholder={t("profile.fields.selectCity")}
						searchPlaceholder={searchPlaceholder}
						emptyText={emptyText}
						trailing={city.trailing}
						fallbackInput={cityNeedsFallback}
						autoComplete="address-level2"
					/>
				</FieldShell>
			)}
		</div>
	);
}
