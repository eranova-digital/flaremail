import type { ReactNode } from "react";

import { FlaremailLogo } from "@/components/FlaremailLogo";
import { cn } from "@/lib/utils";

type AuthPageShellProps = {
	title: string;
	description?: string;
	/** Title/description alignment. Default center matches login/bootstrap. */
	align?: "center" | "start";
	children: ReactNode;
};

/** Pin a primary action above the software keyboard on small screens. */
export const authStickyActionClassName =
	"max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-6 max-sm:bg-card max-sm:px-6 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]";

export function AuthPageShell({
	title,
	description,
	align = "center",
	children,
}: AuthPageShellProps) {
	return (
		<div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
			<div className="w-full max-w-sm space-y-6">
				<div className="flex flex-col items-center gap-4">
					<span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl shadow-sm">
						<FlaremailLogo className="size-5" />
					</span>
					<div
						className={cn(
							"w-full space-y-1.5",
							align === "start" ? "text-left" : "text-center",
						)}
					>
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
