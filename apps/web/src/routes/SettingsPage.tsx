import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { DomainSection } from "@/components/settings/DomainSection";
import { MailboxSection } from "@/components/settings/MailboxSection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["domains", "mailboxes"] as const;
type SettingsTab = (typeof TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
	return value !== null && (TABS as readonly string[]).includes(value);
}

export function SettingsPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "domains";

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
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-8">
				<Tabs value={activeTab} onValueChange={handleTabChange}>
					<TabsList>
						<TabsTrigger value="domains">Domains</TabsTrigger>
						<TabsTrigger value="mailboxes">Mailboxes</TabsTrigger>
					</TabsList>
					<TabsContent value="domains">
						<DomainSection />
					</TabsContent>
					<TabsContent value="mailboxes">
						<MailboxSection />
					</TabsContent>
				</Tabs>
			</main>
		</div>
	);
}
