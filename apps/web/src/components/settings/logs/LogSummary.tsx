import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import type { ResolvedRef } from "@/lib/logs/api";
import { cn } from "@/lib/utils";

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

function RefChip({ refValue }: { refValue: ResolvedRef }) {
	const muted = refValue.deleted;
	const label =
		refValue.kind === "account" ? refValue.displayName : refValue.label;

	if (refValue.kind === "account") {
		return (
			<span
				className={cn(
					"bg-muted/60 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs",
					muted && "opacity-60",
				)}
				title={refValue.loginIdentifier}
			>
				<ProfileAvatar
					seed={refValue.id}
					label={label}
					profilePicture={refValue.deleted ? null : refValue.profilePicture}
					accountId={refValue.id}
					className="size-4 text-[8px]"
				/>
				<span className="truncate font-medium">{label}</span>
			</span>
		);
	}

	if (refValue.kind === "thread" && !refValue.deleted) {
		return (
			<Link
				to={`/?thread=${refValue.id}`}
				className="bg-muted/60 hover:bg-muted inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-xs font-medium underline-offset-2 hover:underline"
			>
				<span className="truncate">{label}</span>
			</Link>
		);
	}

	if (refValue.kind === "mailbox" && !refValue.deleted) {
		return (
			<span
				className="bg-muted/60 inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 font-mono text-xs"
				title={refValue.id}
			>
				<span className="truncate">{label}</span>
			</span>
		);
	}

	return (
		<span
			className={cn(
				"bg-muted/60 inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-xs",
				muted && "opacity-60 italic",
			)}
			title={refValue.id}
		>
			<span className="truncate">{label}</span>
		</span>
	);
}

export function LogSummary({
	summary,
	refs,
}: {
	summary: string;
	refs: Record<string, ResolvedRef>;
}) {
	const parts: ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	const re = new RegExp(PLACEHOLDER_RE.source, "g");

	while ((match = re.exec(summary)) !== null) {
		if (match.index > lastIndex) {
			parts.push(summary.slice(lastIndex, match.index));
		}
		const key = match[1];
		const refValue = refs[key];
		if (refValue) {
			parts.push(<RefChip key={`${key}-${match.index}`} refValue={refValue} />);
		} else {
			parts.push(match[0]);
		}
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < summary.length) {
		parts.push(summary.slice(lastIndex));
	}

	return (
		<span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1 text-sm leading-relaxed">
			{parts}
		</span>
	);
}
