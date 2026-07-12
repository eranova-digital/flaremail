import {
	Archive,
	Building2,
	FileText,
	Inbox,
	PanelLeftClose,
	PanelLeftOpen,
	Pencil,
	Send,
	ShieldAlert,
	Trash2,
} from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { MailboxSwitcher } from '@/components/layout/MailboxSwitcher';
import { LabelsSection } from '@/components/layout/LabelsSection';
import { UserCard } from '@/components/layout/UserCard';
import { FlaremailLogo } from '@/components/FlaremailLogo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMailboxes } from '@/hooks/use-mailboxes';
import type { ThreadFolder } from '@/lib/api/client';
import {
	getFoldersForMailbox,
	resolveFolderForMailbox,
	FOLDER_LABELS,
	isThreadFolder,
} from '@/lib/mailbox-folders';
import { cn } from '@/lib/utils';
import { canAccessManagementPage } from '@/lib/accounts/permissions';
import { useAuth } from '@/lib/auth/AuthProvider';

const FOLDER_ICONS: Record<ThreadFolder, typeof Inbox> = {
	inbox: Inbox,
	sent: Send,
	drafts: FileText,
	archived: Archive,
	trash: Trash2,
	spam: ShieldAlert,
};

const SIDEBAR_COLLAPSED_KEY = 'flaremail:sidebar-collapsed';

function useSidebarCollapsed(): [boolean, () => void] {
	const [collapsed, setCollapsed] = useState<boolean>(() => {
		if (typeof window === 'undefined') {
			return false;
		}
		return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
	});

	useEffect(() => {
		window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
	}, [collapsed]);

	return [collapsed, () => setCollapsed((value) => !value)];
}

function withTooltip(collapsed: boolean, label: string, trigger: ReactElement): ReactElement {
	if (!collapsed) {
		return trigger;
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>{trigger}</TooltipTrigger>
			<TooltipContent side="right">{label}</TooltipContent>
		</Tooltip>
	);
}

export function FolderSidebar() {
	const navigate = useNavigate();
	const { account } = useAuth();
	const showManagement = canAccessManagementPage(account);
	const { mailboxId, folder: folderParam, labelId } = useParams();
	const [searchParams] = useSearchParams();
	const mailboxesQuery = useMailboxes();
	const mailbox = mailboxesQuery.data?.find((item) => item.id === mailboxId);
	const visibleFolders = getFoldersForMailbox(mailbox ?? {});
	const [collapsed, toggleCollapsed] = useSidebarCollapsed();
	const activeFolder =
		labelId
			? null
			: resolveFolderForMailbox(
					mailbox ?? {},
					folderParam && isThreadFolder(folderParam)
						? folderParam
						: searchParams.get('folder'),
				);

	if (!mailboxId) {
		return null;
	}

	return (
		<TooltipProvider delayDuration={0}>
			<aside
				className={cn(
					'bg-muted/30 flex h-full shrink-0 flex-col border-r transition-[width] duration-200 ease-in-out',
					collapsed ? 'w-14' : 'w-56',
				)}
			>
				<div className={cn('space-y-3 p-3', collapsed && 'px-2')}>
					<div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
						{!collapsed ? (
							<div className="flex min-w-0 items-center gap-2">
								<span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-[45%] shadow-sm">
									<FlaremailLogo className="size-3.5" />
								</span>
								<h1 className="truncate text-lg font-semibold tracking-tight">Flaremail</h1>
							</div>
						) : null}
						{withTooltip(
							collapsed,
							'Expand sidebar',
							<Button
								variant="ghost"
								size="icon"
								className="size-8 shrink-0"
								aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
								onClick={toggleCollapsed}
							>
								{collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
							</Button>,
						)}
					</div>
					{!collapsed ? <MailboxSwitcher /> : null}
					{withTooltip(
						collapsed,
						'Compose',
						<Button
							className={cn(collapsed ? 'size-10 p-0' : 'w-full')}
							size={collapsed ? 'icon' : 'default'}
							onClick={() => navigate(`/m/${mailboxId}/compose`)}
							aria-label="Compose"
						>
							{collapsed ? <Pencil className="size-4" /> : 'Compose'}
						</Button>,
					)}
				</div>
				<Separator />
				<nav className={cn('min-h-0 flex-1 space-y-1 overflow-y-auto p-2', collapsed && 'px-2')}>
					{visibleFolders.map((item) => {
						const Icon = FOLDER_ICONS[item];
						const link = (
							<NavLink
								to={`/m/${mailboxId}/${item}`}
								className={({ isActive }) =>
									cn(
										'hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
										collapsed && 'justify-center px-0',
										(isActive || (!labelId && activeFolder === item)) &&
											'bg-accent text-accent-foreground font-medium',
									)
								}
							>
								<Icon className="size-4 shrink-0" />
								{!collapsed ? FOLDER_LABELS[item] : null}
							</NavLink>
						);
						return <div key={item}>{withTooltip(collapsed, FOLDER_LABELS[item], link)}</div>;
					})}
					<Separator className="my-2" />
					<LabelsSection
						collapsed={collapsed}
						withTooltip={(label, trigger) => withTooltip(collapsed, label, trigger)}
					/>
				</nav>
				<div className={cn('space-y-1 p-2', collapsed && 'px-2')}>
					{showManagement
						? withTooltip(
								collapsed,
								'Management',
								<NavLink
									to="/management"
									className={({ isActive }) =>
										cn(
											'hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
											collapsed && 'justify-center px-0',
											isActive && 'bg-accent text-accent-foreground font-medium',
										)
									}
								>
									<Building2 className="size-4 shrink-0" />
									{!collapsed ? 'Management' : null}
								</NavLink>,
							)
						: null}
					<UserCard collapsed={collapsed} />
				</div>
			</aside>
		</TooltipProvider>
	);
}
