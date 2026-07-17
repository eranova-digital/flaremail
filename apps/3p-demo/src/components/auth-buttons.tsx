"use client";

import { authClient } from "@/lib/auth-client";

export function SignInButton() {
	return (
		<button
			type="button"
			className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
			onClick={() => {
				void authClient.signIn.oauth2({
					providerId: "flaremail",
					callbackURL: "/",
				});
			}}
		>
			Sign in with Flaremail
		</button>
	);
}

export function SignOutButton() {
	return (
		<button
			type="button"
			className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
			onClick={() => {
				void authClient.signOut({
					fetchOptions: {
						onSuccess: () => {
							window.location.href = "/";
						},
					},
				});
			}}
		>
			Sign out
		</button>
	);
}
