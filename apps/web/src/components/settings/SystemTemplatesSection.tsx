import { useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useDeleteSystemEmailTemplate,
	useSystemEmailTemplates,
	useUploadSystemEmailTemplate,
} from "@/hooks/use-email-templates";
import { SystemTemplatePreviewButton } from "@/components/email-templates/TemplatePreviewButton";
import { SystemTemplateDownloadButton } from "@/components/email-templates/TemplateDownloadButton";
import { getErrorMessage } from "@/lib/api/errors";
import type {
	SystemEmailTemplate,
	SystemEmailTemplateKey,
} from "@/lib/email-templates/api";

export function SystemTemplatesSection() {
	const templatesQuery = useSystemEmailTemplates();
	const uploadMutation = useUploadSystemEmailTemplate();
	const deleteMutation = useDeleteSystemEmailTemplate();
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadingKey, setUploadingKey] = useState<SystemEmailTemplateKey | null>(
		null,
	);
	const [deleteTarget, setDeleteTarget] = useState<SystemEmailTemplate | null>(
		null,
	);
	const fileInputRefs = useRef<
		Partial<Record<SystemEmailTemplateKey, HTMLInputElement | null>>
	>({});

	const items = templatesQuery.data ?? [];

	const uploadFor = async (key: SystemEmailTemplateKey, file: File) => {
		setUploadError(null);
		setUploadingKey(key);
		try {
			await uploadMutation.mutateAsync({ key, file });
		} catch (error) {
			setUploadError(getErrorMessage(error));
		} finally {
			setUploadingKey(null);
		}
	};

	return (
		<section className="space-y-4 border-t pt-8">
			<div>
				<h2 className="text-lg font-medium">System templates</h2>
				<p className="text-muted-foreground text-sm">
					Optional HTML for instance emails (invites, password reset, and
					recovery codes). If unset, Flaremail sends the built-in plain-text
					message. Use the listed tags in your HTML — they are replaced when the
					email is sent.
				</p>
			</div>

			{uploadError ? (
				<Alert tone="destructive" title="Upload failed">
					<p>{uploadError}</p>
				</Alert>
			) : null}

			{templatesQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<Skeleton key={index} className="h-24 w-full rounded-lg" />
					))}
				</div>
			) : templatesQuery.isError ? (
				<Alert tone="destructive" title="Couldn't load system templates">
					<p>{getErrorMessage(templatesQuery.error)}</p>
				</Alert>
			) : (
				<ul className="divide-border border-border divide-y rounded-lg border">
					{items.map((template) => (
						<li key={template.key} className="space-y-3 px-3 py-3">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0 flex-1 space-y-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="text-sm font-medium">{template.label}</p>
										{template.configured ? (
											<Badge variant="secondary">Custom HTML</Badge>
										) : (
											<Badge variant="outline">Default text</Badge>
										)}
									</div>
									<p className="text-muted-foreground text-xs leading-relaxed">
										{template.description}
									</p>
									<p className="text-muted-foreground text-xs">
										Subject: {template.subject}
									</p>
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
									<input
										ref={(node) => {
											fileInputRefs.current[template.key] = node;
										}}
										type="file"
										accept=".html,.htm,text/html"
										className="hidden"
										onChange={(event) => {
											const file = event.target.files?.[0];
											if (file) {
												void uploadFor(template.key, file);
											}
											event.target.value = "";
										}}
									/>
									<SystemTemplatePreviewButton
										templateKey={template.key}
										disabled={!template.configured}
									/>
									<SystemTemplateDownloadButton
										templateKey={template.key}
										templateLabel={template.label}
										disabled={!template.configured}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={uploadingKey === template.key}
										onClick={() =>
											fileInputRefs.current[template.key]?.click()
										}
									>
										<Upload className="size-3.5" aria-hidden />
										{template.configured ? "Replace" : "Upload"}
									</Button>
									{template.configured ? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={deleteMutation.isPending}
											onClick={() => setDeleteTarget(template)}
										>
											Revert
										</Button>
									) : null}
								</div>
							</div>
							<div className="bg-muted/50 rounded-md px-2.5 py-2">
								<p className="text-muted-foreground mb-1.5 text-xs font-medium">
									Available tags
								</p>
								<ul className="space-y-1">
									{template.tags.map((tag) => (
										<li
											key={tag.name}
											className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"
										>
											<code className="bg-background rounded px-1 py-0.5 font-mono">
												{`{${tag.name}}`}
											</code>
											<span className="text-muted-foreground">
												{tag.description}
											</span>
										</li>
									))}
								</ul>
							</div>
						</li>
					))}
				</ul>
			)}

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				title="Revert to default?"
				description={
					deleteTarget
						? `Remove the custom HTML for “${deleteTarget.label}”? Flaremail will send the built-in plain-text email again.`
						: ""
				}
				confirmLabel="Revert"
				pending={deleteMutation.isPending}
				onConfirm={() => {
					if (!deleteTarget) {
						return;
					}
					void deleteMutation.mutateAsync(deleteTarget.key).then(() => {
						setDeleteTarget(null);
					});
				}}
			/>
		</section>
	);
}
