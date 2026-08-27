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
import { useTranslation } from 'react-i18next';
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

type FolderSidebarProps = {
	/** `drawer` fills a sheet and stays expanded; `rail` is the desktop sidebar. */
	variant?: 'rail' | 'drawer';
	/** Called after a navigation action so a mobile drawer can close. */
	onNavigate?: () => void;
};

export function FolderSidebar({ variant = 'rail', onNavigate }: FolderSidebarProps) {
	const { t } = useTranslation('mail');
	const { t: tc } = useTranslation('common');
	const navigate = useNavigate();
	const { account } = useAuth();
	const showManagement = canAccessManagementPage(account);
	const { mailboxId, folder: folderParam, labelId } = useParams();
	const [searchParams] = useSearchParams();
	const mailboxesQuery = useMailboxes();
	const mailbox = mailboxesQuery.data?.find((item) => item.id === mailboxId);
	const visibleFolders = getFoldersForMailbox(mailbox ?? {});
	const [railCollapsed, toggleCollapsed] = useSidebarCollapsed();
	const isDrawer = variant === 'drawer';
	const collapsed = isDrawer ? false : railCollapsed;
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

	const expandLabel = t('sidebar.expand');
	const collapseLabel = t('sidebar.collapse');
	const composeLabel = t('sidebar.compose');
	const managementLabel = tc('management');

	const go = (path: string) => {
		navigate(path);
		onNavigate?.();
	};

	return (
		<TooltipProvider delayDuration={0}>
			<aside
				className={cn(
					'bg-muted/30 flex h-full shrink-0 flex-col border-r transition-[width] duration-200 ease-in-out',
					isDrawer ? 'w-full border-r-0' : collapsed ? 'w-14' : 'w-56',
				)}
			>
				<div className={cn('space-y-3 p-3', collapsed && 'px-2')}>
					<div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
						{!collapsed ? (
							<div className="flex min-w-0 items-center gap-2">
								<span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-[45%] shadow-sm">
									<FlaremailLogo className="size-3.5" />
								</span>
								<h1 className="truncate text-lg font-semibold tracking-tight">{tc('appName')}</h1>
							</div>
						) : null}
						{!isDrawer
							? withTooltip(
									collapsed,
									expandLabel,
									<Button
										variant="ghost"
										size="icon"
										className="size-8 shrink-0"
										aria-label={collapsed ? expandLabel : collapseLabel}
										onClick={toggleCollapsed}
									>
										{collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
									</Button>,
								)
							: null}
					</div>
					{!collapsed ? <MailboxSwitcher onNavigate={onNavigate} /> : null}
					{withTooltip(
						collapsed,
						composeLabel,
						<Button
							className={cn(collapsed ? 'size-10 p-0' : 'w-full')}
							size={collapsed ? 'icon' : 'default'}
							onClick={() => go(`/m/${mailboxId}/compose`)}
							aria-label={composeLabel}
						>
							{collapsed ? <Pencil className="size-4" /> : composeLabel}
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
								onClick={() => onNavigate?.()}
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
						onNavigate={onNavigate}
						withTooltip={(label, trigger) => withTooltip(collapsed, label, trigger)}
					/>
				</nav>
				<div className={cn('space-y-1 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]', collapsed && 'px-2')}>
					{showManagement
						? withTooltip(
								collapsed,
								managementLabel,
								<NavLink
									to="/management"
									onClick={() => onNavigate?.()}
									className={({ isActive }) =>
										cn(
											'hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
											collapsed && 'justify-center px-0',
											isActive && 'bg-accent text-accent-foreground font-medium',
										)
									}
								>
									<Building2 className="size-4 shrink-0" />
									{!collapsed ? managementLabel : null}
								</NavLink>,
							)
						: null}
					<UserCard collapsed={collapsed} onNavigate={onNavigate} />
				</div>
			</aside>
		</TooltipProvider>
	);
}
