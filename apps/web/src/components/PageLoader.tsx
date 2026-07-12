import { Loader2 } from 'lucide-react';

import { FLAREMAIL_LOGO_PATH, FlaremailLogo } from '@/components/FlaremailLogo';
import { cn } from '@/lib/utils';

type PageLoaderProps = {
	/** Optional short label describing what is loading. */
	label?: string;
	className?: string;
};

function PageLoaderBackdrop() {
	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
			<div className="absolute inset-0 bg-linear-to-b from-primary/5 via-background to-background" />
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 1000 1000"
				className="text-primary/60 absolute top-1/2 left-1/2 size-[min(55vw,40rem)] -translate-x-1/2 -translate-y-1/2 blur-sm"
			>
				<path
					d={FLAREMAIL_LOGO_PATH}
					fill="none"
					stroke="currentColor"
					strokeWidth="6"
					strokeLinecap="round"
					strokeLinejoin="round"
					pathLength={1}
					className="animate-logo-outline"
				/>
			</svg>
		</div>
	);
}

/**
 * Full-page loading state that keeps brand context on screen instead of an
 * anonymous skeleton. Used while auth/session state resolves.
 */
export function PageLoader({ label = 'Loading…', className }: PageLoaderProps) {
	return (
		<div
			className={cn(
				'bg-background relative isolate flex min-h-svh flex-col items-center justify-center gap-4 overflow-hidden p-8',
				className,
			)}
		>
			{/* <PageLoaderBackdrop /> */}
			<div className="relative z-10 flex items-center gap-2.5">
				<span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
					<FlaremailLogo className="size-4.5" />
				</span>
				<span className="text-lg font-semibold tracking-tight">Flaremail</span>
			</div>
			<div className="text-muted-foreground relative z-10 flex items-center gap-2 text-sm" role="status">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				{label}
			</div>
		</div>
	);
}
