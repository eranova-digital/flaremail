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
	verifyMfaSignIn,
} from "@/lib/auth/api";
import type { Account, SignInResult } from "@/lib/auth/types";

type AuthContextValue = {
	account: Account | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	refresh: () => Promise<void>;
	signIn: (
		email: string,
		password: string,
	) => Promise<Account | { requiresMfa: true; mfaToken: string }>;
	verifyMfa: (mfaToken: string, code: string) => Promise<Account>;
	signOut: () => Promise<void>;
	activate: (input: {
		code: string;
		password: string;
		profile?: {
			firstName?: string;
			lastName?: string;
			recoveryAddress?: string | null;
			phone?: string | null;
			addressCountry?: string | null;
			addressState?: string | null;
			addressCity?: string | null;
			addressLine1?: string | null;
			addressLine2?: string | null;
		};
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
		const result: SignInResult = await signInRequest(email, password);
		if ("requiresMfa" in result && result.requiresMfa) {
			return { requiresMfa: true as const, mfaToken: result.mfaToken };
		}
		const me = await fetchMe();
		setAccount(me);
		return me;
	}, []);

	const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
		await verifyMfaSignIn(mfaToken, code);
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
			profile?: {
				firstName?: string;
				lastName?: string;
				recoveryAddress?: string | null;
				phone?: string | null;
				addressCountry?: string | null;
				addressState?: string | null;
				addressCity?: string | null;
				addressLine1?: string | null;
				addressLine2?: string | null;
			};
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
			verifyMfa,
			signOut,
			activate,
			resetPassword: resetPasswordAction,
		}),
		[
			account,
			isLoading,
			refresh,
			signIn,
			verifyMfa,
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
