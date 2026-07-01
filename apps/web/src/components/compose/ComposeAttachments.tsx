import { FileIcon, Paperclip, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import type { ComposeAttachment } from "@/lib/compose-attachments";
import { createLocalAttachment } from "@/lib/compose-attachments";
import { formatFileSize } from "@/lib/format-bytes";

type ComposeAttachmentsProps = {
	attachments: ComposeAttachment[];
	onChange: (attachments: ComposeAttachment[]) => void;
	disabled?: boolean;
};

export function ComposeAttachments({
	attachments,
	onChange,
	disabled = false,
}: ComposeAttachmentsProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFilesSelected = (files: FileList | null) => {
		if (!files?.length) {
			return;
		}

		const next = [
			...attachments,
			...Array.from(files).map((file) => createLocalAttachment(file)),
		];
		onChange(next);

		if (inputRef.current) {
			inputRef.current.value = "";
		}
	};

	const removeAttachment = (key: string) => {
		onChange(attachments.filter((attachment) => attachment.key !== key));
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<label className="text-sm font-medium">Attachments</label>
				<div>
					<input
						ref={inputRef}
						type="file"
						multiple
						className="hidden"
						disabled={disabled}
						onChange={(event) => handleFilesSelected(event.target.files)}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={() => inputRef.current?.click()}
					>
						<Paperclip className="size-4" />
						Add files
					</Button>
				</div>
			</div>

			{attachments.length > 0 ? (
				<ul className="space-y-2">
					{attachments.map((attachment) => (
						<li
							key={attachment.key}
							className="bg-muted/40 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
						>
							<div className="flex min-w-0 items-center gap-2">
								<FileIcon className="text-muted-foreground size-4 shrink-0" />
								<div className="min-w-0">
									<p className="truncate text-sm">{attachment.filename}</p>
									<p className="text-muted-foreground text-xs">
										{formatFileSize(attachment.sizeBytes)}
									</p>
								</div>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8 shrink-0"
								disabled={disabled}
								onClick={() => removeAttachment(attachment.key)}
								aria-label={`Remove ${attachment.filename}`}
							>
								<X className="size-4" />
							</Button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">No attachments added.</p>
			)}
		</div>
	);
}
