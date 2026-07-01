import { Outlet } from "react-router-dom";

import { FolderSidebar } from "@/components/layout/FolderSidebar";
import { ThreadList } from "@/components/layout/ThreadList";

export function MailboxLayout() {
	return (
		<div className="flex h-svh overflow-hidden">
			<FolderSidebar />
			<ThreadList />
			<main className="min-w-0 flex-1">
				<Outlet />
			</main>
		</div>
	);
}
