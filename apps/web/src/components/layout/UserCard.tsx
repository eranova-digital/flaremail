import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
	getAccountDisplayName,
	ProfileAvatar,
} from '@/components/ProfileAvatar';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';

type UserCardProps = {
	collapsed: boolean;
};

export function UserCard({ collapsed }: UserCardProps) {
	const { account, signOut } = useAuth();
	const navigate = useNavigate();
	const [signingOut, setSigningOut] = useState(false);

	if (!account) {
		return null;
	}

	const displayName = getAccountDisplayName(account);

	const handleSignOut = async () => {
		setSigningOut(true);
		try {
			await signOut();
			navigate('/login', { replace: true });
		} finally {
			setSigningOut(false);
		}
	};

	const trigger = (
		<DropdownMenuTrigger asChild>
			<button
				type="button"
				aria-label="Account menu"
				className={cn(
					'hover:bg-accent data-[state=open]:bg-accent flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors',
					collapsed && 'justify-center p-1.5',
				)}
			>
				<ProfileAvatar
					seed={account.loginIdentifier}
					label={displayName}
					className="size-8 text-xs"
				/>
				{!collapsed ? (
					<>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-medium">{displayName}</span>
							<span className="text-muted-foreground block truncate text-xs">
								{account.loginIdentifier}
							</span>
						</span>
						<ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
					</>
				) : null}
			</button>
		</DropdownMenuTrigger>
	);

	return (
		<DropdownMenu>
			{collapsed ? (
				<Tooltip>
					<TooltipTrigger asChild>{trigger}</TooltipTrigger>
					<TooltipContent side="right">{displayName}</TooltipContent>
				</Tooltip>
			) : (
				trigger
			)}
			<DropdownMenuContent side="top" align="start" className="w-56">
				<DropdownMenuLabel className="font-normal">
					<span className="block truncate text-sm font-medium">{displayName}</span>
					<span className="text-muted-foreground block truncate text-xs">
						{account.loginIdentifier}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => navigate('/settings')}>
					<Settings className="size-4" />
					Settings
				</DropdownMenuItem>
				<DropdownMenuItem disabled={signingOut} onSelect={() => void handleSignOut()}>
					<LogOut className="size-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
