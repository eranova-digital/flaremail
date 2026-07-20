import { useMemo } from "react";
import { City, Country, State } from "country-state-city";
import { useTranslation } from "react-i18next";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ProfileFieldKey } from "@/lib/accounts/api";

const CLEAR_VALUE = "__clear__";

type AddressLocationFieldsProps = {
	values: Record<string, string>;
	onChange: (key: ProfileFieldKey, value: string) => void;
	idPrefix: string;
	disabled?: boolean;
	isFieldDisabled?: (key: ProfileFieldKey) => boolean;
	labelExtra?: (key: ProfileFieldKey) => React.ReactNode;
	requiredFields?: ReadonlySet<string>;
	hiddenFields?: ReadonlySet<string>;
};

function ensureOption(
	options: Array<{ value: string; label: string }>,
	current: string,
): Array<{ value: string; label: string }> {
	const trimmed = current.trim();
	if (!trimmed) {
		return options;
	}
	if (options.some((option) => option.value === trimmed)) {
		return options;
	}
	return [{ value: trimmed, label: trimmed }, ...options];
}

function countryIsoFromName(name: string): string | undefined {
	const trimmed = name.trim();
	if (!trimmed) {
		return undefined;
	}
	const byIso = Country.getCountryByCode(trimmed);
	if (byIso) {
		return byIso.isoCode;
	}
	return Country.getAllCountries().find(
		(country) => country.name.toLowerCase() === trimmed.toLowerCase(),
	)?.isoCode;
}

function stateIsoFromName(countryIso: string, name: string): string | undefined {
	const trimmed = name.trim();
	if (!trimmed || !countryIso) {
		return undefined;
	}
	const states = State.getStatesOfCountry(countryIso);
	const byIso = states.find((state) => state.isoCode === trimmed);
	if (byIso) {
		return byIso.isoCode;
	}
	return states.find(
		(state) => state.name.toLowerCase() === trimmed.toLowerCase(),
	)?.isoCode;
}

export function AddressLocationFields({
	values,
	onChange,
	idPrefix,
	disabled = false,
	isFieldDisabled,
	labelExtra,
	requiredFields,
	hiddenFields,
}: AddressLocationFieldsProps) {
	const { t } = useTranslation("settings");

	const countryName = values.addressCountry ?? "";
	const stateName = values.addressState ?? "";
	const cityName = values.addressCity ?? "";

	const countryIso = useMemo(
		() => countryIsoFromName(countryName),
		[countryName],
	);
	const stateIso = useMemo(
		() => (countryIso ? stateIsoFromName(countryIso, stateName) : undefined),
		[countryIso, stateName],
	);

	const countryOptions = useMemo(
		() =>
			ensureOption(
				Country.getAllCountries().map((country) => ({
					value: country.name,
					label: country.name,
				})),
				countryName,
			),
		[countryName],
	);

	const stateOptions = useMemo(() => {
		if (!countryIso) {
			return ensureOption([], stateName);
		}
		return ensureOption(
			State.getStatesOfCountry(countryIso).map((state) => ({
				value: state.name,
				label: state.name,
			})),
			stateName,
		);
	}, [countryIso, stateName]);

	const cityOptions = useMemo(() => {
		if (!countryIso || !stateIso) {
			return ensureOption([], cityName);
		}
		return ensureOption(
			City.getCitiesOfState(countryIso, stateIso).map((city) => ({
				value: city.name,
				label: city.name,
			})),
			cityName,
		);
	}, [cityName, countryIso, stateIso]);

	const renderSelect = (
		key: "addressCountry" | "addressState" | "addressCity",
		options: Array<{ value: string; label: string }>,
		onSelect: (value: string) => void,
		enabled: boolean,
	) => {
		if (hiddenFields?.has(key)) {
			return null;
		}
		const inputId = `${idPrefix}-${key}`;
		const isRequired = requiredFields?.has(key) ?? false;
		const isInputDisabled =
			disabled || !enabled || (isFieldDisabled?.(key) ?? false);
		const current = values[key] ?? "";

		return (
			<div className="space-y-1">
				<div className="flex min-h-5 items-center justify-between gap-2">
					<label htmlFor={inputId} className="text-sm font-medium">
						{t(`profile.fields.${key}`)}
						{isRequired ? (
							<span className="text-destructive ml-1">*</span>
						) : null}
					</label>
					{labelExtra?.(key)}
				</div>
				<Select
					value={current || undefined}
					onValueChange={(value) => {
						if (value === CLEAR_VALUE) {
							onSelect("");
							return;
						}
						onSelect(value);
					}}
					disabled={isInputDisabled}
				>
					<SelectTrigger id={inputId} className="w-full">
						<SelectValue
							placeholder={t(`profile.fields.${key}Placeholder`, {
								defaultValue: t(`profile.fields.${key}`),
							})}
						/>
					</SelectTrigger>
					<SelectContent className="max-h-72">
						{!isRequired ? (
							<SelectItem value={CLEAR_VALUE}>
								{t("profile.fields.clearLocation", {
									defaultValue: "Clear",
								})}
							</SelectItem>
						) : null}
						{options.map((option) => (
							<SelectItem key={`${key}-${option.value}`} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	};

	return (
		<div className="grid gap-3 sm:grid-cols-3">
			{renderSelect(
				"addressCountry",
				countryOptions,
				(value) => {
					onChange("addressCountry", value);
					onChange("addressState", "");
					onChange("addressCity", "");
				},
				true,
			)}
			{renderSelect(
				"addressState",
				stateOptions,
				(value) => {
					onChange("addressState", value);
					onChange("addressCity", "");
				},
				Boolean(countryIso),
			)}
			{renderSelect(
				"addressCity",
				cityOptions,
				(value) => onChange("addressCity", value),
				Boolean(countryIso && stateIso),
			)}
		</div>
	);
}
