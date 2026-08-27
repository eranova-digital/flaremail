import type { ReactNode } from "react";

import { FlaremailLogo } from "@/components/FlaremailLogo";

type AuthPageShellProps = {
	title: string;
	description?: string;
	children: ReactNode;
};

export function AuthPageShell({ title, description, children }: AuthPageShellProps) {
	return (
		<div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
			<div className="w-full max-w-sm space-y-6">
				<div className="flex flex-col items-center gap-4 text-center">
					<span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl shadow-sm">
						<FlaremailLogo className="size-5" />
					</span>
					<div className="space-y-1.5">
						<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
						{description ? (
							<p className="text-muted-foreground text-sm text-balance">
								{description}
							</p>
						) : null}
					</div>
				</div>
				{children}
			</div>
		</div>
	);
}
