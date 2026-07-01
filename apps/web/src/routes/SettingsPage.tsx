import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { DomainSection } from "@/components/settings/DomainSection";
import { MailboxSection } from "@/components/settings/MailboxSection";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SettingsPage() {
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

			<main className="mx-auto max-w-3xl space-y-10 px-6 py-8">
				<DomainSection />
				<Separator />
				<MailboxSection />
			</main>
		</div>
	);
}
