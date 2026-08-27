import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import { useIsMobile } from "@/hooks/use-is-mobile";

type MailboxNavContextValue = {
	isMobile: boolean;
	navOpen: boolean;
	setNavOpen: (open: boolean) => void;
	openNav: () => void;
	closeNav: () => void;
};

const MailboxNavContext = createContext<MailboxNavContextValue | null>(null);

export function MailboxNavProvider({ children }: { children: ReactNode }) {
	const isMobile = useIsMobile();
	const [navOpen, setNavOpen] = useState(false);

	const openNav = useCallback(() => setNavOpen(true), []);
	const closeNav = useCallback(() => setNavOpen(false), []);

	const value = useMemo(
		() => ({
			isMobile,
			navOpen,
			setNavOpen,
			openNav,
			closeNav,
		}),
		[isMobile, navOpen, openNav, closeNav],
	);

	return (
		<MailboxNavContext.Provider value={value}>{children}</MailboxNavContext.Provider>
	);
}

export function useMailboxNav(): MailboxNavContextValue {
	const value = useContext(MailboxNavContext);
	if (!value) {
		throw new Error("useMailboxNav must be used within MailboxNavProvider");
	}
	return value;
}

/** Safe for components that may render outside the mail shell (returns desktop defaults). */
export function useMailboxNavOptional(): MailboxNavContextValue | null {
	return useContext(MailboxNavContext);
}
