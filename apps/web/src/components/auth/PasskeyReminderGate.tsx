import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { PasskeyReminderDialog } from "@/components/auth/PasskeyReminderDialog";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchPasskeys } from "@/lib/auth/api";
import { isPasskeySupported } from "@/lib/auth/passkey-support";
import {
	recordPasskeyReminderShown,
	shouldShowPasskeyReminder,
} from "@/lib/auth/passkey-reminder-storage";

export function PasskeyReminderGate() {
	const { account } = useAuth();
	const [open, setOpen] = useState(false);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (!account?.id || !isPasskeySupported()) {
			setReady(true);
			return;
		}

		let cancelled = false;

		(async () => {
			try {
				const result = await fetchPasskeys();
				if (cancelled) {
					return;
				}
				if (
					result.items.length === 0 &&
					shouldShowPasskeyReminder(account.id)
				) {
					setOpen(true);
				}
			} catch {
				// Skip the reminder when passkey status cannot be loaded.
			} finally {
				if (!cancelled) {
					setReady(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [account?.id]);

	const handleDismiss = () => {
		if (account?.id) {
			recordPasskeyReminderShown(account.id);
		}
		setOpen(false);
	};

	const handlePasskeyAdded = () => {
		setOpen(false);
	};

	if (!ready) {
		return <Outlet />;
	}

	return (
		<>
			<Outlet />
			<PasskeyReminderDialog
				open={open}
				onOpenChange={setOpen}
				onDismiss={handleDismiss}
				onPasskeyAdded={handlePasskeyAdded}
			/>
		</>
	);
}
