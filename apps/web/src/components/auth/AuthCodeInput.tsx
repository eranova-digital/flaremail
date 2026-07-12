import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";

import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { formatAuthCode } from "@/lib/format-auth-code";
import { cn } from "@/lib/utils";

type AuthCodeInputProps = {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	autoFocus?: boolean;
	invalid?: boolean;
	className?: string;
};

function authCodeRaw(value: string): string {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function AuthCodeInput({
	id,
	value,
	onChange,
	disabled = false,
	autoFocus = false,
	invalid = false,
	className,
}: AuthCodeInputProps) {
	const rawValue = authCodeRaw(value);

	return (
		<InputOTP
			id={id}
			maxLength={8}
			pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
			autoComplete="one-time-code"
			value={rawValue}
			onChange={(nextValue) => onChange(formatAuthCode(nextValue))}
			disabled={disabled}
			autoFocus={autoFocus}
			containerClassName={cn("font-mono uppercase tracking-wider", className)}
		>
			<InputOTPGroup aria-invalid={invalid || undefined}>
				<InputOTPSlot index={0} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={1} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={2} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={3} aria-invalid={invalid || undefined} />
			</InputOTPGroup>
			<InputOTPSeparator />
			<InputOTPGroup aria-invalid={invalid || undefined}>
				<InputOTPSlot index={4} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={5} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={6} aria-invalid={invalid || undefined} />
				<InputOTPSlot index={7} aria-invalid={invalid || undefined} />
			</InputOTPGroup>
		</InputOTP>
	);
}

export function isAuthCodeComplete(value: string): boolean {
	return authCodeRaw(value).length === 8;
}
