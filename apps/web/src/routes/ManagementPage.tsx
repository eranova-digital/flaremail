import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { DomainSection } from "@/components/settings/DomainSection";
import { MailboxSection } from "@/components/settings/MailboxSection";
import { ManagerMailboxGrantsSection } from "@/components/settings/ManagerMailboxGrantsSection";
import { AccountsSection } from "@/components/settings/AccountsSection";
import { OrganizationSection } from "@/components/settings/OrganizationSection";
import { OidcClientsSection } from "@/components/settings/OidcClientsSection";
import { TemplatesSection } from "@/components/settings/TemplatesSection";
import { LogsSection } from "@/components/settings/LogsSection";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SettingsShell } from "@/components/layout/SettingsShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	canAccessAccountsTab,
	canAccessDomainsTab,
	canAccessLogsTab,
	canAccessMailboxesTab,
	canAccessManagementPage,
	canAccessTemplatesTab,
	canManageMailboxes,
	canManageOidcClients,
	showsManagerMailboxGrantsTab,
} from "@/lib/accounts/permissions";
import { useCanAccessOrganizationTab } from "@/hooks/use-instance-settings";
import { useAuth } from "@/lib/auth/AuthProvider";

const ALL_TABS = [
	"domains",
	"mailboxes",
	"accounts",
	"templates",
	"organization",
	"oidc",
	"logs",
] as const;
type ManagementTab = (typeof ALL_TABS)[number];

function isManagementTab(value: string | null): value is ManagementTab {
	return value !== null && (ALL_TABS as readonly string[]).includes(value);
}

function defaultTab(
	showDomains: boolean,
	showMailboxes: boolean,
	showAccounts: boolean,
	showTemplates: boolean,
	showOrganization: boolean,
	showOidc: boolean,
	showLogs: boolean,
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
	if (showTemplates) {
		return "templates";
	}
	if (showOrganization) {
		return "organization";
	}
	if (showOidc) {
		return "oidc";
	}
	if (showLogs) {
		return "logs";
	}
	return "domains";
}

function resolveActiveTab(
	tabParam: string | null,
	showDomains: boolean,
	showMailboxes: boolean,
	showAccounts: boolean,
	showTemplates: boolean,
	showOrganization: boolean,
	showOidc: boolean,
	showLogs: boolean,
): ManagementTab {
	const fallback = defaultTab(
		showDomains,
		showMailboxes,
		showAccounts,
		showTemplates,
		showOrganization,
		showOidc,
		showLogs,
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
	if (tabParam === "templates" && !showTemplates) {
		return fallback;
	}
	if (tabParam === "organization" && !showOrganization) {
		return fallback;
	}
	if (tabParam === "oidc" && !showOidc) {
		return fallback;
	}
	if (tabParam === "logs" && !showLogs) {
		return fallback;
	}
	return tabParam;
}

export function ManagementPage() {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const { account } = useAuth();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const organizationAccess = useCanAccessOrganizationTab(account);
	const showDomains = canAccessDomainsTab(account);
	const showMailboxes = canAccessMailboxesTab(account);
	const showAccounts = canAccessAccountsTab(account);
	const showTemplates = canAccessTemplatesTab(account);
	const showOrganization = organizationAccess.canAccess;
	const showOidc = canManageOidcClients(account);
	const showLogs = canAccessLogsTab(account);
	const activeTab = resolveActiveTab(
		tabParam,
		showDomains,
		showMailboxes,
		showAccounts,
		showTemplates,
		showOrganization,
		showOidc,
		showLogs,
	);

	useEffect(() => {
		if (activeTab !== "organization" || !location.hash) {
			return;
		}
		const id = location.hash.slice(1);
		const frame = requestAnimationFrame(() => {
			document.getElementById(id)?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
		return () => cancelAnimationFrame(frame);
	}, [activeTab, location.hash]);

	if (!canAccessManagementPage(account)) {
		return <Navigate to="/settings" replace />;
	}

	const handleTabChange = (value: string) => {
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("tab", value);
				if (value !== "accounts") {
					next.delete("account");
				}
				if (value !== "logs") {
					next.delete("q");
					next.delete("maxImportance");
					next.delete("type");
					next.delete("from");
					next.delete("to");
					next.delete("limit");
				} else if (!next.has("maxImportance")) {
					next.set("maxImportance", "5");
				}
				return next;
			},
			{ replace: true },
		);
	};

	return (
		<SettingsShell
			rootLabel={tc("management")}
			rootTo="/management"
			backTo="/"
			backLabel={tc("backToMail")}
			actions={<LogoutButton />}
		>
			<Tabs value={activeTab} onValueChange={handleTabChange}>
				<TabsList>
					{showDomains ? (
						<TabsTrigger value="domains">{t("tabs.domains")}</TabsTrigger>
					) : null}
					{showMailboxes ? (
						<TabsTrigger value="mailboxes">{t("tabs.mailboxes")}</TabsTrigger>
					) : null}
					{showAccounts ? (
						<TabsTrigger value="accounts">{t("tabs.accounts")}</TabsTrigger>
					) : null}
					{showTemplates ? (
						<TabsTrigger value="templates">{t("tabs.templates")}</TabsTrigger>
					) : null}
					{showOrganization ? (
						<TabsTrigger value="organization">{t("tabs.organization")}</TabsTrigger>
					) : null}
					{showOidc ? (
						<TabsTrigger value="oidc">{t("tabs.oidc")}</TabsTrigger>
					) : null}
					{showLogs ? <TabsTrigger value="logs">{t("tabs.logs")}</TabsTrigger> : null}
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
				{showTemplates ? (
					<TabsContent value="templates">
						<TemplatesSection />
					</TabsContent>
				) : null}
				{showOrganization ? (
					<TabsContent value="organization">
						<OrganizationSection />
					</TabsContent>
				) : null}
				{showOidc ? (
					<TabsContent value="oidc">
						<OidcClientsSection />
					</TabsContent>
				) : null}
				{showLogs ? (
					<TabsContent value="logs">
						<LogsSection />
					</TabsContent>
				) : null}
			</Tabs>
		</SettingsShell>
	);
}
