import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { DomainSection } from "@/components/settings/DomainSection";
import { MailboxSection } from "@/components/settings/MailboxSection";
import { ManagerMailboxGrantsSection } from "@/components/settings/ManagerMailboxGrantsSection";
import { AccountsSection } from "@/components/settings/AccountsSection";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	canAccessAccountsTab,
	canAccessDomainsTab,
	canAccessMailboxesTab,
	canEditOwnProfile,
	canManageMailboxes,
	showsManagerMailboxGrantsTab,
} from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";

const ALL_TABS = ["profile", "domains", "mailboxes", "accounts"] as const;
type SettingsTab = (typeof ALL_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
	return value !== null && (ALL_TABS as readonly string[]).includes(value);
}

function defaultTab(
	showProfile: boolean,
	showDomains: boolean,
	showMailboxes: boolean,
	showAccounts: boolean,
): SettingsTab {
	if (showProfile) {
		return "profile";
	}
	if (showDomains) {
		return "domains";
	}
	if (showMailboxes) {
		return "mailboxes";
	}
	if (showAccounts) {
		return "accounts";
	}
	return "profile";
}

function resolveActiveTab(
	tabParam: string | null,
	showProfile: boolean,
	showDomains: boolean,
	showMailboxes: boolean,
	showAccounts: boolean,
): SettingsTab {
	const fallback = defaultTab(
		showProfile,
		showDomains,
		showMailboxes,
		showAccounts,
	);

	if (!isSettingsTab(tabParam)) {
		return fallback;
	}
	if (tabParam === "profile" && !showProfile) {
		return fallback;
	}
	if (tabParam === "domains" && !showDomains) {
		return fallback;
	}
	if (tabParam === "mailboxes" && !showMailboxes) {
		return fallback;
	}
	if (tabParam === "accounts" && !showAccounts) {
		return fallback;
	}
	return tabParam;
}

export function SettingsPage() {
	const { account } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const showProfile = canEditOwnProfile(account);
	const showDomains = canAccessDomainsTab(account);
	const showMailboxes = canAccessMailboxesTab(account);
	const showAccounts = canAccessAccountsTab(account);
	const activeTab = resolveActiveTab(
		tabParam,
		showProfile,
		showDomains,
		showMailboxes,
		showAccounts,
	);

	const handleTabChange = (value: string) => {
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("tab", value);
				return next;
			},
			{ replace: true },
		);
	};

	return (
		<div className="bg-background min-h-svh">
			<header className="border-b">
				<div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
					<Button variant="ghost" size="icon" asChild>
						<Link to="/" aria-label="Back to mail">
							<ArrowLeft className="size-4" />
						</Link>
					</Button>
					<h1 className="text-xl font-semibold tracking-tight">Settings</h1>
					<div className="ml-auto">
						<LogoutButton variant="settings" />
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-8">
				<Tabs value={activeTab} onValueChange={handleTabChange}>
					<TabsList>
						{showProfile ? (
							<TabsTrigger value="profile">Profile</TabsTrigger>
						) : null}
						{showDomains ? (
							<TabsTrigger value="domains">Domains</TabsTrigger>
						) : null}
						{showMailboxes ? (
							<TabsTrigger value="mailboxes">Mailboxes</TabsTrigger>
						) : null}
						{showAccounts ? (
							<TabsTrigger value="accounts">Accounts</TabsTrigger>
						) : null}
					</TabsList>
					{showProfile ? (
						<TabsContent value="profile">
							<ProfileSection />
						</TabsContent>
					) : null}
					{showDomains ? (
						<TabsContent value="domains">
							<DomainSection />
						</TabsContent>
					) : null}
					{showMailboxes ? (
						<TabsContent value="mailboxes">
							{showsManagerMailboxGrantsTab(account) ? (
								<ManagerMailboxGrantsSection />
							) : canManageMailboxes(account) ? (
								<MailboxSection />
							) : null}
						</TabsContent>
					) : null}
					{showAccounts ? (
						<TabsContent value="accounts">
							<AccountsSection />
						</TabsContent>
					) : null}
				</Tabs>
			</main>
		</div>
	);
}
