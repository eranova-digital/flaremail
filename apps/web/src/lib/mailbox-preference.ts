const STORAGE_KEY = "flaremail.lastMailboxId";

export function getLastMailboxId(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

export function setLastMailboxId(mailboxId: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, mailboxId);
	} catch {
		// ignore quota / private mode
	}
}
