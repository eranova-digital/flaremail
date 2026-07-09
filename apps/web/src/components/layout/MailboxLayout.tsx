import { useDefaultLayout } from 'react-resizable-panels';
import { Navigate, Outlet, useParams } from 'react-router-dom';

import { FolderSidebar } from '@/components/layout/FolderSidebar';
import { ThreadList } from '@/components/layout/ThreadList';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import { useMailboxes } from '@/hooks/use-mailboxes';
import { getLastMailboxId } from '@/lib/mailbox-preference';
import { getDefaultFolderForMailbox } from '@/lib/mailbox-folders';
import { resolveSelectableMailbox } from '@/lib/selectable-mailbox';

export function MailboxLayout() {
	const { mailboxId } = useParams();
	const mailboxesQuery = useMailboxes();
	const { defaultLayout, onLayoutChanged } = useDefaultLayout({
		id: 'flaremail:panels',
	});

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
		<div className="flex h-svh overflow-hidden">
			<FolderSidebar />
			<ResizablePanelGroup orientation="horizontal" className="flex-1" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
				<ResizablePanel id="list" defaultSize="35" minSize="20rem">
					<ThreadList />
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel id="view" defaultSize="65" minSize="48rem">
					<main className="h-full min-w-0">
						<Outlet />
					</main>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
