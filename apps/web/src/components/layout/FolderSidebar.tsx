import { Archive, FileText, Inbox, Send, Settings, ShieldAlert, Trash2 } from 'lucide-react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MailboxSwitcher } from '@/components/layout/MailboxSwitcher';
import { FOLDER_LABELS, FOLDERS, isThreadFolder } from '@/lib/folders';
import type { ThreadFolder } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const FOLDER_ICONS: Record<ThreadFolder, typeof Inbox> = {
	inbox: Inbox,
	sent: Send,
	drafts: FileText,
	archived: Archive,
	trash: Trash2,
	spam: ShieldAlert,
};

export function FolderSidebar() {
	const navigate = useNavigate();
	const { mailboxId, folder: folderParam } = useParams();
	const [searchParams] = useSearchParams();
	const activeFolder =
		folderParam && isThreadFolder(folderParam)
			? folderParam
			: isThreadFolder(searchParams.get('folder') ?? '')
				? (searchParams.get('folder') as ThreadFolder)
				: 'inbox';

	if (!mailboxId) {
		return null;
	}

	return (
		<aside className="bg-muted/30 flex h-full w-3xs shrink-0 flex-col border-r">
			<div className="space-y-3 p-3">
				<div className="px-1">
					<h1 className="text-lg font-semibold tracking-tight">Flaremail</h1>
				</div>
				<MailboxSwitcher />
				<Button className="w-full" onClick={() => navigate(`/m/${mailboxId}/compose`)}>
					Compose
				</Button>
			</div>
			<Separator />
			<nav className="flex-1 space-y-1 p-2">
				{FOLDERS.map((item) => {
					const Icon = FOLDER_ICONS[item];
					return (
						<NavLink
							key={item}
							to={`/m/${mailboxId}/${item}`}
							className={({ isActive }) =>
								cn(
									'hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
									(isActive || activeFolder === item) && 'bg-accent text-accent-foreground font-medium',
								)
							}
						>
							<Icon className="size-4 shrink-0" />
							{FOLDER_LABELS[item]}
						</NavLink>
					);
				})}
			</nav>
			<div className="p-2">
				<NavLink
					to="/settings"
					className={({ isActive }) =>
						cn(
							'hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
							isActive && 'bg-accent text-accent-foreground font-medium',
						)
					}
				>
					<Settings className="size-4 shrink-0" />
					Settings
				</NavLink>
			</div>
		</aside>
	);
}
