import { PageLoader } from "@/components/PageLoader";

/** Dev-only route to preview the full-page loader indefinitely. */
export function LoadingPage() {
	return <PageLoader label="Loading…" />;
}
