import { Pencil } from 'lucide-react';
import { Navigate, Outlet, useMatch, useNavigate, useParams } from 'react-router-dom';
import { useDefaultLayout } from 'react-resizable-panels';
import { useTranslation } from 'react-i18next';

import { FolderSidebar } from '@/components/layout/FolderSidebar';
import { MailboxNavProvider, useMailboxNav } from '@/components/layout/MailboxNavContext';
import { ThreadList } from '@/components/layout/ThreadList';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useMailboxes } from '@/hooks/use-mailboxes';
import { getLastMailboxId } from '@/lib/mailbox-preference';
import { getDefaultFolderForMailbox } from '@/lib/mailbox-folders';
import { composePath } from '@/lib/mailbox-routes';
import { resolveSelectableMailbox } from '@/lib/selectable-mailbox';

function MailboxShell() {
	const { t } = useTranslation('mail');
	const navigate = useNavigate();
	const { mailboxId, threadId } = useParams();
	const composeMatch = useMatch('/m/:mailboxId/compose');
	const { isMobile, navOpen, setNavOpen, closeNav } = useMailboxNav();
	const { defaultLayout, onLayoutChanged } = useDefaultLayout({
		id: 'flaremail:panels',
	});

	const showDetail = Boolean(threadId) || Boolean(composeMatch);
	const showList = !isMobile || !showDetail;
	const composeLabel = t('sidebar.compose');

	const navSheet = isMobile ? (
		<Sheet open={navOpen} onOpenChange={setNavOpen}>
			<SheetContent side="left" className="w-[min(20rem,85vw)] p-0 sm:max-w-none" showCloseButton={false}>
				<SheetTitle className="sr-only">{t('sidebar.navigation')}</SheetTitle>
				<SheetDescription className="sr-only">{t('sidebar.navigation')}</SheetDescription>
				<FolderSidebar variant="drawer" onNavigate={closeNav} />
			</SheetContent>
		</Sheet>
	) : null;

	if (isMobile) {
		return (
			<div className="flex h-svh overflow-hidden pt-[env(safe-area-inset-top)]">
				{navSheet}
				<div className="relative flex min-w-0 flex-1 flex-col">
					{showList ? (
						<div className="h-full min-h-0 min-w-0 pb-20">
							<ThreadList />
						</div>
					) : null}
					{showDetail ? (
						<main className="h-full min-h-0 min-w-0">
							<Outlet />
						</main>
					) : null}
					{showList && mailboxId ? (
						<Button
							size="icon"
							className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 size-14 rounded-full shadow-lg [&_svg]:size-5"
							aria-label={composeLabel}
							onClick={() => navigate(composePath(mailboxId, {}))}
						>
							<Pencil />
						</Button>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-svh overflow-hidden">
			<FolderSidebar />
			<ResizablePanelGroup
				orientation="horizontal"
				className="flex-1"
				defaultLayout={defaultLayout}
				onLayoutChanged={onLayoutChanged}
			>
				<ResizablePanel id="list" defaultSize="35" minSize="16rem" maxSize="50">
					<ThreadList />
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel id="view" defaultSize="65" minSize="20rem">
					<main className="h-full min-w-0">
						<Outlet />
					</main>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

export function MailboxLayout() {
	const { mailboxId } = useParams();
	const mailboxesQuery = useMailboxes();

	if (mailboxesQuery.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	const mailbox = mailboxesQuery.data?.find((item) => item.id === mailboxId);
	if (mailbox?.type === 'alias') {
		const fallback = resolveSelectableMailbox(mailboxesQuery.data ?? [], getLastMailboxId());
		if (!fallback?.id) {
			return <Navigate to="/" replace />;
		}

		return <Navigate to={`/m/${fallback.id}/${getDefaultFolderForMailbox(fallback)}`} replace />;
	}

	return (
		<MailboxNavProvider>
			<MailboxShell />
		</MailboxNavProvider>
	);
}
