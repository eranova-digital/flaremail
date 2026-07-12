import { REGEXP_ONLY_DIGITS } from "input-otp";

import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";

type TotpCodeInputProps = {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	autoFocus?: boolean;
	invalid?: boolean;
	className?: string;
};

export function TotpCodeInput({
	id,
	value,
	onChange,
	disabled = false,
	autoFocus = false,
	invalid = false,
	className,
}: TotpCodeInputProps) {
	return (
		<InputOTP
			id={id}
			maxLength={6}
			pattern={REGEXP_ONLY_DIGITS}
			inputMode="numeric"
			autoComplete="one-time-code"
			value={value}
			onChange={onChange}
			disabled={disabled}
			autoFocus={autoFocus}
			containerClassName={className}
		>
			<InputOTPGroup aria-invalid={invalid || undefined}>
				<InputOTPSlot index={0} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={1} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={2} aria-invalid={invalid || undefined} />
			</InputOTPGroup>
			<InputOTPSeparator />
			<InputOTPGroup aria-invalid={invalid || undefined}>
				<InputOTPSlot index={3} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={4} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={5} aria-invalid={invalid || undefined} />
			</InputOTPGroup>
		</InputOTP>
	);
}

export function isTotpCodeComplete(value: string): boolean {
	return value.length === 6;
}
