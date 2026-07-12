import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { ConfigErrorScreen } from "./components/ConfigErrorScreen";
import { TooltipProvider } from "./components/ui/tooltip";
import "./lib/api/client";
import { getApiUrl } from "./lib/api";
import { AuthProvider } from "./lib/auth/AuthProvider";
import "./index.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: 1,
		},
	},
});

function Root() {
	const configError = useMemo(() => {
		try {
			getApiUrl();
			return null;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid configuration";
		}
	}, []);

	if (configError) {
		return <ConfigErrorScreen message={configError} />;
	}

	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider delayDuration={300}>
				<BrowserRouter>
					<AuthProvider>
						<App />
					</AuthProvider>
				</BrowserRouter>
			</TooltipProvider>
		</QueryClientProvider>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Root />
	</StrictMode>,
);
