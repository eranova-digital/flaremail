import { Lock, LockOpen } from "lucide-react";

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
	return (
		<Toggle
			size="sm"
			variant="outline"
			pressed={locked}
			onPressedChange={() => onToggle()}
			disabled={disabled}
			aria-label={locked ? "Unlock field" : "Lock field"}
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
