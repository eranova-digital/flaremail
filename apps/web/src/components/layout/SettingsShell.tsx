import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

type Crumb = {
	label: string;
	to?: string;
};

type SettingsShellProps = {
	/** Root breadcrumb label. Defaults to common "Settings". */
	rootLabel?: string;
	/** Root breadcrumb link. Defaults to "/settings". */
	rootTo?: string;
	/**
	 * Breadcrumb trail rendered after the implicit root.
	 * The last crumb is the current page and renders as plain text.
	 */
	crumbs?: Crumb[];
	/** Where the back button points. Defaults to the mail app root. */
	backTo?: string;
	backLabel?: string;
	/** Right-aligned header actions (e.g. sign out, recheck). */
	actions?: ReactNode;
	/** Optional one-line description under the header title. */
	description?: string;
	/** Max content width utility class. Defaults to a comfortable form width. */
	widthClassName?: string;
	children: ReactNode;
};

export function SettingsShell({
	rootLabel,
	rootTo = "/settings",
	crumbs = [],
	backTo = "/",
	backLabel,
	actions,
	description,
	widthClassName = "max-w-4xl",
	children,
}: SettingsShellProps) {
	const { t } = useTranslation("mail");
	const { t: tc } = useTranslation("common");
	const resolvedRootLabel = rootLabel ?? tc("settings");
	const resolvedBackLabel = backLabel ?? tc("back");
	const title = crumbs.length > 0 ? crumbs[crumbs.length - 1].label : resolvedRootLabel;
	const trail = crumbs.slice(0, -1);

	return (
		<div className="bg-background min-h-svh">
			<header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
				<div
					className={`mx-auto flex items-center gap-3 px-4 py-3 sm:px-6 ${widthClassName}`}
				>
					<Button variant="ghost" size="icon" asChild>
						<Link to={backTo} aria-label={resolvedBackLabel}>
							<ArrowLeft className="size-4" />
						</Link>
					</Button>
					<nav
						aria-label={t("settingsShell.breadcrumb")}
						className="flex min-w-0 flex-1 items-center gap-1.5"
					>
						{crumbs.length === 0 ? (
							<h1 className="truncate text-base font-semibold tracking-tight">
								{resolvedRootLabel}
							</h1>
						) : (
							<>
								<Link
									to={rootTo}
									className="text-muted-foreground hover:text-foreground shrink-0 text-sm font-medium transition-colors"
								>
									{resolvedRootLabel}
								</Link>
								{trail.map((crumb) => (
									<span
										key={crumb.label}
										className="flex min-w-0 items-center gap-1.5"
									>
										<ChevronRight
											className="text-muted-foreground/60 size-3.5 shrink-0"
											aria-hidden
										/>
										{crumb.to ? (
											<Link
												to={crumb.to}
												className="text-muted-foreground hover:text-foreground truncate text-sm font-medium transition-colors"
											>
												{crumb.label}
											</Link>
										) : (
											<span className="text-muted-foreground truncate text-sm font-medium">
												{crumb.label}
											</span>
										)}
									</span>
								))}
								<ChevronRight
									className="text-muted-foreground/60 size-3.5 shrink-0"
									aria-hidden
								/>
								<h1 className="truncate text-base font-semibold tracking-tight">
									{title}
								</h1>
							</>
						)}
					</nav>
					{actions ? (
						<div className="flex shrink-0 items-center gap-2">{actions}</div>
					) : null}
				</div>
			</header>

			<main className={`mx-auto px-4 py-8 sm:px-6 ${widthClassName}`}>
				{description ? (
					<p className="text-muted-foreground -mt-2 mb-6 text-sm">{description}</p>
				) : null}
				{children}
			</main>
		</div>
	);
}
