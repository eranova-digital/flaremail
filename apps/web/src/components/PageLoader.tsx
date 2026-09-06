import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FlaremailLogo } from '@/components/FlaremailLogo';
import { cn } from '@/lib/utils';

type PageLoaderProps = {
	/** Optional short label describing what is loading. */
	label?: string;
	className?: string;
};

/**
 * Full-page loading state that keeps brand context on screen instead of an
 * anonymous skeleton. Used while auth/session state resolves.
 */
export function PageLoader({ label, className }: PageLoaderProps) {
	const { t } = useTranslation('common');
	const resolvedLabel = label ?? t('loading');

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
				<span className="text-lg font-semibold tracking-tight">{t('appName')}</span>
			</div>
			<div className="text-muted-foreground relative z-10 flex items-center gap-2.5 text-sm" role="status">
				<Loader2 className="text-primary size-5 animate-spin" aria-hidden />
				{resolvedLabel}
			</div>
		</div>
	);
}
