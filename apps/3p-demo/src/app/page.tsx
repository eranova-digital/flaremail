import { headers } from "next/headers";

import { SignInButton } from "@/components/auth-buttons";
import { auth } from "@/lib/auth";

export default async function HomePage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return (
			<section className="space-y-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold tracking-tight">
						Sign in with Flaremail
					</h1>
					<p className="max-w-xl text-zinc-600 dark:text-zinc-400">
						This app is a relying party. It uses better-auth + Flaremail OIDC
						(Authorization Code + PKCE) so you can exercise client registration,
						consent, and token exchange end-to-end.
					</p>
				</div>
				<SignInButton />
				<ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
					<li>
						In Flaremail Management → OIDC, create a confidential client.
					</li>
					<li>
						Redirect URI:{" "}
						<code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
							http://localhost:3000/api/auth/oauth2/callback/flaremail
						</code>
					</li>
					<li>
						Allowed scopes: <code>openid profile email</code>. Leave M2M empty
						unless you need Client Credentials.
					</li>
					<li>
						Copy client id/secret into{" "}
						<code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
							apps/3p-demo/.env
						</code>
						.
					</li>
				</ol>
			</section>
		);
	}

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">Signed in</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					Session established via Flaremail OIDC.
				</p>
			</div>
			<div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
				{session.user.image ? (
					<img
						src={session.user.image}
						alt=""
						className="size-16 rounded-full object-cover"
					/>
				) : (
					<div className="flex size-16 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
						{(session.user.name ?? "?").slice(0, 2).toUpperCase()}
					</div>
				)}
				<dl className="grid min-w-0 flex-1 gap-3">
					<div>
						<dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
							Name
						</dt>
						<dd className="mt-1 text-lg font-medium">{session.user.name}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
							Email
						</dt>
						<dd className="mt-1 text-lg font-medium">{session.user.email}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
							User id
						</dt>
						<dd className="mt-1 font-mono text-sm break-all">
							{session.user.id}
						</dd>
					</div>
					{session.user.image ? (
						<div>
							<dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
								Picture
							</dt>
							<dd className="mt-1 font-mono text-xs break-all text-zinc-500">
								{session.user.image}
							</dd>
						</div>
					) : null}
				</dl>
			</div>
		</section>
	);
}
