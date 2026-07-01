import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api";

export default function App() {
	const apiUrl = getApiUrl();

	return (
		<main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8">
			<h1 className="text-3xl font-semibold tracking-tight">Flaremail</h1>
			<p className="text-muted-foreground max-w-md text-center text-sm">
				Web app stub — Vite, React, and shadcn/ui are wired up. Build out
				mailbox UI here.
			</p>
			<p className="text-muted-foreground text-xs">
				API: <code className="font-mono">{apiUrl}</code>
			</p>
			<Button type="button">shadcn Button</Button>
		</main>
	);
}
