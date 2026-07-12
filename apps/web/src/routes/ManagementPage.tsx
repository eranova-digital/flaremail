import { Navigate, useSearchParams } from "react-router-dom";

import { DomainSection } from "@/components/settings/DomainSection";
import { MailboxSection } from "@/components/settings/MailboxSection";
import { ManagerMailboxGrantsSection } from "@/components/settings/ManagerMailboxGrantsSection";
import { AccountsSection } from "@/components/settings/AccountsSection";
import { OrganizationSection } from "@/components/settings/OrganizationSection";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SettingsShell } from "@/components/layout/SettingsShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	canAccessAccountsTab,
	canAccessDomainsTab,
	canAccessMailboxesTab,
	canAccessManagementPage,
	canManageMailboxes,
	showsManagerMailboxGrantsTab,
} from "@/lib/accounts/permissions";
import { useCanAccessOrganizationTab } from "@/hooks/use-instance-settings";
import { useAuth } from "@/lib/auth/AuthProvider";

const ALL_TABS = ["domains", "mailboxes", "accounts", "organization"] as const;
type ManagementTab = (typeof ALL_TABS)[number];

function isManagementTab(value: string | null): value is ManagementTab {
	return value !== null && (ALL_TABS as readonly string[]).includes(value);
}

function defaultTab(
	showDomains: boolean,
	showMailboxes: boolean,
	showAccounts: boolean,
	showOrganization: boolean,
): ManagementTab {
	if (showDomains) {
		return "domains";
	}
	if (showMailboxes) {
		return "mailboxes";
	}
	if (showAccounts) {
		return "accounts";
	}
	if (showOrganization) {
		return "organization";
	}
	return "domains";
}

function resolveActiveTab(
	tabParam: string | null,
	showDomains: boolean,
	showMailboxes: boolean,
	showAccounts: boolean,
	showOrganization: boolean,
): ManagementTab {
	const fallback = defaultTab(
		showDomains,
		showMailboxes,
		showAccounts,
		showOrganization,
	);

	if (!isManagementTab(tabParam)) {
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
	if (tabParam === "organization" && !showOrganization) {
		return fallback;
	}
	return tabParam;
}

export function ManagementPage() {
	const { account } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const organizationAccess = useCanAccessOrganizationTab(account);
	const showDomains = canAccessDomainsTab(account);
	const showMailboxes = canAccessMailboxesTab(account);
	const showAccounts = canAccessAccountsTab(account);
	const showOrganization = organizationAccess.canAccess;
	const activeTab = resolveActiveTab(
		tabParam,
		showDomains,
		showMailboxes,
		showAccounts,
		showOrganization,
	);

	if (!canAccessManagementPage(account)) {
		return <Navigate to="/settings" replace />;
	}

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
		<SettingsShell
			rootLabel="Management"
			rootTo="/management"
			backTo="/"
			backLabel="Back to mail"
			actions={<LogoutButton />}
		>
			<Tabs value={activeTab} onValueChange={handleTabChange}>
				<TabsList>
					{showDomains ? (
						<TabsTrigger value="domains">Domains</TabsTrigger>
					) : null}
					{showMailboxes ? (
						<TabsTrigger value="mailboxes">Mailboxes</TabsTrigger>
					) : null}
					{showAccounts ? (
						<TabsTrigger value="accounts">People & access</TabsTrigger>
					) : null}
					{showOrganization ? (
						<TabsTrigger value="organization">Organization</TabsTrigger>
					) : null}
				</TabsList>
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
				{showOrganization ? (
					<TabsContent value="organization">
						<OrganizationSection />
					</TabsContent>
				) : null}
			</Tabs>
		</SettingsShell>
	);
}
