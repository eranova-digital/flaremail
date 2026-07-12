import type { ReactNode } from "react";

type AuthPageShellProps = {
	title: string;
	description?: string;
	children: ReactNode;
};

export function AuthPageShell({ title, description, children }: AuthPageShellProps) {
	return (
		<div className="bg-background flex min-h-svh flex-col items-center justify-center p-6">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					{description ? (
						<p className="text-muted-foreground mt-2 text-sm">{description}</p>
					) : null}
				</div>
				{children}
			</div>
		</div>
	);
}
