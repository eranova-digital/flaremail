import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import {
	activateAccount,
	fetchMe,
	isUnauthenticatedError,
	resetPassword,
	signIn as signInRequest,
	signOut as signOutRequest,
} from "@/lib/auth/api";
import type { Account } from "@/lib/auth/types";

type AuthContextValue = {
	account: Account | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	refresh: () => Promise<void>;
	signIn: (email: string, password: string) => Promise<Account>;
	signOut: () => Promise<void>;
	activate: (input: {
		code: string;
		password: string;
		firstName?: string;
		lastName?: string;
	}) => Promise<Account>;
	resetPassword: (input: { code: string; password: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [account, setAccount] = useState<Account | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const me = await fetchMe();
			setAccount(me);
		} catch (error) {
			if (isUnauthenticatedError(error)) {
				setAccount(null);
			} else {
				throw error;
			}
		}
	}, []);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				await refresh();
			} catch {
				if (!cancelled) {
					setAccount(null);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [refresh]);

	const signIn = useCallback(async (email: string, password: string) => {
		await signInRequest(email, password);
		const me = await fetchMe();
		setAccount(me);
		return me;
	}, []);

	const signOut = useCallback(async () => {
		try {
			await signOutRequest();
		} finally {
			setAccount(null);
		}
	}, []);

	const activate = useCallback(
		async (input: {
			code: string;
			password: string;
			firstName?: string;
			lastName?: string;
		}) => {
			await activateAccount(input);
			const me = await fetchMe();
			setAccount(me);
			return me;
		},
		[],
	);

	const resetPasswordAction = useCallback(
		async (input: { code: string; password: string }) => {
			await resetPassword(input);
		},
		[],
	);

	const value = useMemo<AuthContextValue>(
		() => ({
			account,
			isLoading,
			isAuthenticated: account !== null,
			refresh,
			signIn,
			signOut,
			activate,
			resetPassword: resetPasswordAction,
		}),
		[
			account,
			isLoading,
			refresh,
			signIn,
			signOut,
			activate,
			resetPasswordAction,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}

	return context;
}
