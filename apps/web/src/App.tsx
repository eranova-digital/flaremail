import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { ComposePage } from "@/components/compose/ComposePage";
import { MailboxLayout } from "@/components/layout/MailboxLayout";
import { ThreadView } from "@/components/layout/ThreadView";
import { EmptyReadingPane } from "@/routes/EmptyReadingPane";
import { HomeRedirect } from "@/routes/HomeRedirect";
import { SettingsPage } from "@/routes/SettingsPage";
import { isThreadFolder } from "@/lib/folders";

function ValidatedFolderRoute() {
	const { folder = "inbox" } = useParams();
	if (!isThreadFolder(folder)) {
		return <Navigate to="inbox" replace />;
	}
	return <EmptyReadingPane />;
}

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<HomeRedirect />} />
			<Route path="/settings" element={<SettingsPage />} />
			<Route path="/m/:mailboxId" element={<MailboxLayout />}>
				<Route index element={<Navigate to="inbox" replace />} />
				<Route path="compose" element={<ComposePage />} />
				<Route path="threads/:threadId" element={<ThreadView />} />
				<Route path=":folder" element={<ValidatedFolderRoute />} />
			</Route>
		</Routes>
	);
}
