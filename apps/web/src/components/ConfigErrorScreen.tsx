type ConfigErrorScreenProps = {
	message: string;
};

export function ConfigErrorScreen({ message }: ConfigErrorScreenProps) {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-3 p-8 text-center">
			<h1 className="text-xl font-semibold">Configuration required</h1>
			<p className="text-muted-foreground max-w-md text-sm">{message}</p>
			<p className="text-muted-foreground max-w-md text-xs">
				Copy <code className="font-mono">apps/web/.env.example</code> to{" "}
				<code className="font-mono">apps/web/.env</code> and set{" "}
				<code className="font-mono">API_URL</code> and{" "}
				<code className="font-mono">API_BEARER_TOKEN</code>.
			</p>
		</div>
	);
}
