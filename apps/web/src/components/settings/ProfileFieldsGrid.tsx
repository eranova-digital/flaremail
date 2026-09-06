import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Value as PhoneValue } from "react-phone-number-input";

import { AddressLocationFields } from "@/components/settings/AddressLocationFields";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { type ProfileFieldKey } from "@/lib/accounts/api";

export type { ProfileFieldKey };

const AUTOCOMPLETE: Partial<Record<ProfileFieldKey, string>> = {
	firstName: "given-name",
	lastName: "family-name",
	recoveryAddress: "email",
	phone: "tel",
	addressLine1: "address-line1",
	addressLine2: "address-line2",
};

type ProfileFieldsGridProps = {
	values: Record<string, string>;
	onChange: (key: ProfileFieldKey, value: string) => void;
	/** Prefix for input ids so multiple grids can coexist on a page. */
	idPrefix: string;
	/** Disables every field (e.g. while submitting). */
	disabled?: boolean;
	/** Per-field disabling (e.g. locked fields). */
	isFieldDisabled?: (key: ProfileFieldKey) => boolean;
	/** Extra content rendered at the right end of a field's label row. */
	labelExtra?: (key: ProfileFieldKey) => ReactNode;
	/** Extra content rendered inside the input at the trailing edge. */
	inputExtra?: (key: ProfileFieldKey) => ReactNode;
	requiredFields?: ReadonlySet<string>;
	hiddenFields?: ReadonlySet<string>;
};

/**
 * Shared layout for the account profile form: name and contact fields in a
 * two-column grid, address fields grouped under their own heading.
 */
export function ProfileFieldsGrid({
	values,
	onChange,
	idPrefix,
	disabled = false,
	isFieldDisabled,
	labelExtra,
	inputExtra,
	requiredFields,
	hiddenFields,
}: ProfileFieldsGridProps) {
	const { t } = useTranslation("settings");

	const field = (key: ProfileFieldKey) => {
		if (hiddenFields?.has(key)) {
			return null;
		}
		const inputId = `${idPrefix}-${key}`;
		const isRequired = requiredFields?.has(key) ?? false;
		const extra = labelExtra?.(key);
		const trailing = inputExtra?.(key);
		const isInputDisabled = disabled || (isFieldDisabled?.(key) ?? false);
		return (
			<div className="space-y-1">
				<div className="flex min-h-5 items-center justify-between gap-2">
					<label htmlFor={inputId} className="text-sm font-medium">
						{t(`profile.fields.${key}`)}
						{isRequired ? <span className="text-destructive ml-1">*</span> : null}
					</label>
					{extra}
				</div>
				{key === "phone" ? (
					<div className="flex items-center gap-1">
						<PhoneInput
							id={inputId}
							defaultCountry="US"
							value={(values[key] || undefined) as PhoneValue | undefined}
							onChange={(value) => onChange(key, value ?? "")}
							disabled={isInputDisabled}
							required={isRequired}
							autoComplete={AUTOCOMPLETE.phone}
							className="min-w-0 flex-1"
						/>
						{trailing}
					</div>
				) : trailing ? (
					<InputGroup>
						<InputGroupInput
							id={inputId}
							value={values[key] ?? ""}
							autoComplete={AUTOCOMPLETE[key]}
							onChange={(event) => onChange(key, event.target.value)}
							disabled={isInputDisabled}
							required={isRequired}
						/>
						<InputGroupAddon align="inline-end">{trailing}</InputGroupAddon>
					</InputGroup>
				) : (
					<Input
						id={inputId}
						type="text"
						value={values[key] ?? ""}
						autoComplete={AUTOCOMPLETE[key]}
						onChange={(event) => onChange(key, event.target.value)}
						disabled={isInputDisabled}
						required={isRequired}
					/>
				)}
			</div>
		);
	};

	return (
		<div className="space-y-5">
			<div className="grid gap-3 sm:grid-cols-2">
				{field("firstName")}
				{field("lastName")}
				{field("recoveryAddress")}
				{field("phone")}
			</div>
			<div className="space-y-3">
				<p className="text-muted-foreground text-xs font-medium">
					{t("profile.fields.addressHeading")}
				</p>
				<div className="grid gap-3">
					{field("addressLine1")}
					{field("addressLine2")}
				</div>
				<AddressLocationFields
					values={values}
					onChange={onChange}
					idPrefix={idPrefix}
					disabled={disabled}
					isFieldDisabled={isFieldDisabled}
					labelExtra={labelExtra}
					inputExtra={inputExtra}
					requiredFields={requiredFields}
					hiddenFields={hiddenFields}
				/>
			</div>
		</div>
	);
}
