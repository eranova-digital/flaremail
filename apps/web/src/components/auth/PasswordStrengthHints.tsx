import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
	getPasswordStrengthIssues,
	type PasswordStrengthIssue,
} from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const CHECKS: Array<{
	issue: PasswordStrengthIssue;
	labelKey: "minLength" | "hasLetter" | "hasNumber";
}> = [
	{ issue: "too-short", labelKey: "minLength" },
	{ issue: "missing-letter", labelKey: "hasLetter" },
	{ issue: "missing-number", labelKey: "hasNumber" },
];

type PasswordStrengthHintsProps = {
	password: string;
	className?: string;
};

/**
 * Live checklist of password strength rules. Shown whenever the field is
 * non-empty so users understand why Activate / Reset stays disabled.
 */
export function PasswordStrengthHints({
	password,
	className,
}: PasswordStrengthHintsProps) {
	const { t } = useTranslation("auth");
	const issues = getPasswordStrengthIssues(password);
	const started = password.length > 0;

	if (!started) {
		return (
			<p className={cn("text-muted-foreground text-xs", className)}>
				{t("passwordStrength.hint")}
			</p>
		);
	}

	return (
		<ul className={cn("space-y-1", className)} aria-live="polite">
			{CHECKS.map(({ issue, labelKey }) => {
				const met = !issues.includes(issue);
				return (
					<li
						key={issue}
						className={cn(
							"flex items-center gap-1.5 text-xs",
							met ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
						)}
					>
						{met ? (
							<Check className="size-3.5 shrink-0" aria-hidden />
						) : (
							<X className="size-3.5 shrink-0" aria-hidden />
						)}
						<span>{t(`passwordStrength.${labelKey}`)}</span>
					</li>
				);
			})}
		</ul>
	);
}
