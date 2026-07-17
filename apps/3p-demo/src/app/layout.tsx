import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { auth } from "@/lib/auth";

import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "3p-demo · Flaremail OIDC",
	description: "Third-party demo app signing in via Flaremail OIDC",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
				<header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
					<div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
						<div>
							<p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
								Third-party demo
							</p>
							<p className="font-semibold tracking-tight">3p-demo</p>
						</div>
						{session ? <SignOutButton /> : <SignInButton />}
					</div>
				</header>
				<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
					{children}
				</main>
			</body>
		</html>
	);
}
