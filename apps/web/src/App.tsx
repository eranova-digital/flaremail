import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { ComposePage } from "@/components/compose/ComposePage";
import { MailboxLayout } from "@/components/layout/MailboxLayout";
import { ThreadView } from "@/components/layout/ThreadView";
import { RequireAuth } from "@/lib/auth/RequireAuth";
import { ActivatePage } from "@/routes/ActivatePage";
import { BootstrapPage } from "@/routes/BootstrapPage";
import { DefaultFolderRedirect } from "@/routes/DefaultFolderRedirect";
import { DomainValidationPage } from "@/routes/DomainValidationPage";
import { EmptyReadingPane } from "@/routes/EmptyReadingPane";
import { HomeRedirect } from "@/routes/HomeRedirect";
import { LoginPage } from "@/routes/LoginPage";
import { ResetPasswordPage } from "@/routes/ResetPasswordPage";
import { SettingsPage } from "@/routes/SettingsPage";
import { SharedMailboxUsersPage } from "@/routes/SharedMailboxUsersPage";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { resolveFolderForMailbox } from "@/lib/mailbox-folders";
import { isThreadFolder } from "@/lib/folders";

function ValidatedFolderRoute() {
	const { mailboxId, folder = "inbox" } = useParams();
	const mailboxesQuery = useMailboxes();
	const mailbox = mailboxesQuery.data?.find((item) => item.id === mailboxId);
	const resolvedFolder = resolveFolderForMailbox(mailbox ?? {}, folder);

	if (!isThreadFolder(folder) || resolvedFolder !== folder) {
		return <Navigate to={`../${resolvedFolder}`} replace />;
	}

	return <EmptyReadingPane />;
}

function LabelReadingPane() {
	return <EmptyReadingPane />;
}

export default function App() {
	return (
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route path="/bootstrap" element={<BootstrapPage />} />
			<Route path="/activate" element={<ActivatePage />} />
			<Route path="/reset-password" element={<ResetPasswordPage />} />
			<Route element={<RequireAuth />}>
				<Route path="/" element={<HomeRedirect />} />
				<Route path="/settings" element={<SettingsPage />} />
				<Route
					path="/settings/mailboxes/:mailboxId/users"
					element={<SharedMailboxUsersPage />}
				/>
				<Route
					path="/settings/domains/:domainId/validation"
					element={<DomainValidationPage />}
				/>
				<Route path="/m/:mailboxId" element={<MailboxLayout />}>
					<Route index element={<DefaultFolderRedirect />} />
					<Route path="compose" element={<ComposePage />} />
					<Route path="threads/:threadId" element={<ThreadView />} />
					<Route path="labels/:labelId">
						<Route index element={<LabelReadingPane />} />
						<Route path="threads/:threadId" element={<ThreadView />} />
					</Route>
					<Route path=":folder" element={<ValidatedFolderRoute />} />
				</Route>
			</Route>
		</Routes>
	);
}
