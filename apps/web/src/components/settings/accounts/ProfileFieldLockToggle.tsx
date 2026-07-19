import { Lock, LockOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Toggle } from "@/components/ui/toggle";

type ProfileFieldLockToggleProps = {
	locked: boolean;
	onToggle: () => void;
	disabled?: boolean;
};

export function ProfileFieldLockToggle({
	locked,
	onToggle,
	disabled,
}: ProfileFieldLockToggleProps) {
	const { t } = useTranslation("management");

	return (
		<Toggle
			size="sm"
			variant="outline"
			pressed={locked}
			onPressedChange={() => onToggle()}
			disabled={disabled}
			aria-label={
				locked
					? t("accounts.unlockField")
					: t("accounts.lockField")
			}
			className="size-6 min-w-6 px-0"
		>
			{locked ? (
				<Lock className="size-3" aria-hidden />
			) : (
				<LockOpen className="size-3" aria-hidden />
			)}
		</Toggle>
	);
}
