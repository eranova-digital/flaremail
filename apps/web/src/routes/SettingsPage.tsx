import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { ProfileSection } from "@/components/settings/ProfileSection";
import { IdentitiesSection } from "@/components/settings/IdentitiesSection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SettingsShell } from "@/components/layout/SettingsShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canEditOwnProfile } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";

const ALL_TABS = ["profile", "identities", "preferences", "security"] as const;
type SettingsTab = (typeof ALL_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
	return value !== null && (ALL_TABS as readonly string[]).includes(value);
}

function defaultTab(showProfile: boolean): SettingsTab {
	return showProfile ? "profile" : "identities";
}

function resolveActiveTab(
	tabParam: string | null,
	showProfile: boolean,
): SettingsTab {
	const fallback = defaultTab(showProfile);

	if (!isSettingsTab(tabParam)) {
		return fallback;
	}
	if (tabParam === "profile" && !showProfile) {
		return fallback;
	}
	return tabParam;
}

export function SettingsPage() {
	const { t } = useTranslation("settings");
	const { t: tc } = useTranslation("common");
	const { account } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const showProfile = canEditOwnProfile(account);
	const activeTab = resolveActiveTab(tabParam, showProfile);

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
			backTo="/"
			backLabel={tc("backToMail")}
			actions={<LogoutButton />}
		>
			<Tabs value={activeTab} onValueChange={handleTabChange}>
				<TabsList>
					{showProfile ? (
						<TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
					) : null}
					<TabsTrigger value="identities">{t("tabs.identities")}</TabsTrigger>
					<TabsTrigger value="preferences">{t("tabs.preferences")}</TabsTrigger>
					<TabsTrigger value="security">{t("tabs.security")}</TabsTrigger>
				</TabsList>
				{showProfile ? (
					<TabsContent value="profile">
						<ProfileSection />
					</TabsContent>
				) : null}
				<TabsContent value="identities">
					<IdentitiesSection />
				</TabsContent>
				<TabsContent value="preferences">
					<PreferencesSection />
				</TabsContent>
				<TabsContent value="security">
					<SecuritySection />
				</TabsContent>
			</Tabs>
		</SettingsShell>
	);
}
