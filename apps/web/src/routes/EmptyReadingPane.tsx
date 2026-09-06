import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";

import { useDrafts } from "@/hooks/use-drafts";
import { useThreads } from "@/hooks/use-threads";
import { useThreadsByLabel } from "@/hooks/use-threads-by-label";
import { isThreadFolder } from "@/lib/folders";

function useFolderListEmpty(): boolean {
	const { mailboxId = "", folder: folderParam, labelId } = useParams();
	const [searchParams] = useSearchParams();
	const queryFolder = searchParams.get("folder");
	const folder =
		folderParam && isThreadFolder(folderParam)
			? folderParam
			: queryFolder && isThreadFolder(queryFolder)
				? queryFolder
				: "inbox";

	const isLabel = Boolean(labelId);
	const isDrafts = !isLabel && folder === "drafts";

	const threadsQuery = useThreads(isLabel || isDrafts ? "" : mailboxId, folder);
	const draftsQuery = useDrafts(isDrafts ? mailboxId : "");
	const labelQueries = useThreadsByLabel(mailboxId, labelId ?? "");

	if (isLabel) {
		if (labelQueries.some((query) => query.isError || query.isLoading || !query.data)) {
			return false;
		}
		return labelQueries.every((query) => (query.data?.items?.length ?? 0) === 0);
	}

	if (isDrafts) {
		if (draftsQuery.isError || draftsQuery.isLoading || !draftsQuery.data) {
			return false;
		}
		return (draftsQuery.data.items?.length ?? 0) === 0;
	}

	if (threadsQuery.isError || threadsQuery.isLoading || !threadsQuery.data) {
		return false;
	}
	return (threadsQuery.data.items?.length ?? 0) === 0;
}

export function EmptyReadingPane() {
	const { t } = useTranslation("mail");
	const listEmpty = useFolderListEmpty();

	if (listEmpty) {
		return <div className="h-full" aria-hidden />;
	}

	return (
		<div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm sm:p-8">
			{t("empty.readingPane")}
		</div>
	);
}
