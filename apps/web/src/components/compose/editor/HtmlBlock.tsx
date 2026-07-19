import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { CodeXml, Eye, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";

import {
	applyHtmlPlaceholders,
	blankHtmlPlaceholders,
	findHtmlPlaceholders,
	pruneHtmlPlaceholderValues,
} from "@/components/compose/editor/html-placeholders";
import { htmlFromUploadedText } from "@/components/compose/editor/html-upload";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ViewMode = "edit" | "preview";

function readValues(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	const values: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === "string") {
			values[key] = entry;
		}
	}
	return values;
}

export function HtmlBlock({
	node,
	editor,
	updateAttributes,
	deleteNode,
}: NodeViewProps) {
	const { t } = useTranslation("compose");
	const html = (node.attrs.html as string) || "";
	const values = readValues(node.attrs.values);
	const locked = Boolean(node.attrs.locked);
	const templateName =
		typeof node.attrs.templateName === "string" && node.attrs.templateName.trim()
			? node.attrs.templateName.trim()
			: null;
	const [mode, setMode] = useState<ViewMode>(
		html.trim() || locked ? "preview" : "edit",
	);
	const [draft, setDraft] = useState(html);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const focusedRef = useRef(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const effectiveMode = locked ? "preview" : mode;
	const sourceHtml = effectiveMode === "edit" ? draft : html;
	const placeholders = findHtmlPlaceholders(sourceHtml);
	const blank = blankHtmlPlaceholders(sourceHtml, values);
	const previewHtml = applyHtmlPlaceholders(html, values);

	useEffect(() => {
		if (!focusedRef.current) {
			setDraft(html);
		}
	}, [html]);

	const stopEditorKeys = (event: SyntheticEvent) => {
		event.stopPropagation();
	};

	const setHtml = (next: string) => {
		const nextPlaceholders = findHtmlPlaceholders(next);
		setDraft(next);
		updateAttributes({
			html: next,
			values: pruneHtmlPlaceholderValues(values, nextPlaceholders),
		});
	};

	const setValue = (name: string, nextValue: string) => {
		updateAttributes({
			values: {
				...values,
				[name]: nextValue,
			},
		});
	};

	const uploadHtmlFile = (file: File) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== "string") {
				setUploadError(t("htmlBlock.readFailed"));
				return;
			}

			const next = htmlFromUploadedText(reader.result);
			if (!next) {
				setUploadError(t("htmlBlock.emptyFile"));
				return;
			}

			setUploadError(null);
			setHtml(next);
			setMode("preview");
		};
		reader.onerror = () => {
			setUploadError(t("htmlBlock.readFailed"));
		};
		reader.readAsText(file);
	};

	const removeLabel = locked
		? t("htmlBlock.removeTemplate")
		: t("htmlBlock.remove");

	return (
		<NodeViewWrapper
			as="div"
			className="compose-html-block group/compose-html"
			data-compose-html-block=""
			contentEditable={false}
		>
			<div className="compose-html-toolbar">
				<div
					className="compose-html-mode-toggle"
					role="group"
					aria-label={t("htmlBlock.modeAria")}
				>
					{locked ? (
						<span className="text-muted-foreground flex items-center gap-1.5 px-2 text-xs font-medium">
							<Eye className="size-3.5" aria-hidden />
							{templateName
								? t("htmlBlock.templateNamed", { name: templateName })
								: t("htmlBlock.template")}
						</span>
					) : (
						<>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className={cn(
									"h-7 gap-1.5 px-2 text-xs",
									effectiveMode === "edit" && "bg-accent text-accent-foreground",
								)}
								aria-pressed={effectiveMode === "edit"}
								disabled={!editor.isEditable}
								onClick={() => setMode("edit")}
							>
								<CodeXml className="size-3.5" />
								{t("htmlBlock.edit")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className={cn(
									"h-7 gap-1.5 px-2 text-xs",
									effectiveMode === "preview" &&
										"bg-accent text-accent-foreground",
								)}
								aria-pressed={effectiveMode === "preview"}
								onClick={() => setMode("preview")}
							>
								<Eye className="size-3.5" />
								{t("htmlBlock.preview")}
							</Button>
							{editor.isEditable ? (
								<>
									<input
										ref={fileInputRef}
										type="file"
										accept=".html,.htm,text/html"
										className="hidden"
										onChange={(event) => {
											const file = event.target.files?.[0];
											if (file) {
												uploadHtmlFile(file);
											}
											event.target.value = "";
										}}
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 gap-1.5 px-2 text-xs"
										onClick={() => fileInputRef.current?.click()}
									>
										<Upload className="size-3.5" />
										{t("htmlBlock.upload")}
									</Button>
								</>
							) : null}
						</>
					)}
				</div>
				{editor.isEditable ? (
					<button
						type="button"
						aria-label={removeLabel}
						title={removeLabel}
						className="compose-html-remove"
						onClick={() => deleteNode()}
					>
						<X className="size-3.5" />
					</button>
				) : null}
			</div>
			{uploadError ? (
				<Alert
					tone="destructive"
					title={t("htmlBlock.uploadFailed")}
					className="compose-html-vars-error"
				>
					<p>{uploadError}</p>
				</Alert>
			) : null}
			{blank.length > 0 ? (
				<Alert
					tone="destructive"
					title={t("htmlBlock.unfilledTitle")}
					className="compose-html-vars-error"
				>
					<p>
						{t("htmlBlock.unfilledTags", {
							tags: blank.map((name) => `{${name}}`).join(", "),
							count: blank.length,
						})}
					</p>
				</Alert>
			) : null}
			{placeholders.length > 0 ? (
				<div className="compose-html-vars">
					<div className="compose-html-vars-fields">
						{placeholders.map((name) => (
							<label key={name} className="compose-html-var-field">
								<span className="compose-html-var-label">{`{${name}}`}</span>
								<Input
									value={values[name] ?? ""}
									placeholder={name}
									disabled={!editor.isEditable}
									className={cn(
										"h-7 font-mono text-xs",
										blank.includes(name) && "border-destructive",
									)}
									aria-invalid={blank.includes(name)}
									onMouseDown={stopEditorKeys}
									onKeyDown={stopEditorKeys}
									onChange={(event) => setValue(name, event.target.value)}
								/>
							</label>
						))}
					</div>
				</div>
			) : null}
			{effectiveMode === "edit" ? (
				<Textarea
					value={draft}
					placeholder={t("htmlBlock.editorPlaceholder")}
					spellCheck={false}
					disabled={!editor.isEditable}
					className="compose-html-editor min-h-28 resize-y font-mono text-xs"
					onFocus={() => {
						focusedRef.current = true;
					}}
					onBlur={() => {
						focusedRef.current = false;
						if (draft !== html) {
							setHtml(draft);
						}
					}}
					onChange={(event) => setHtml(event.target.value)}
					onMouseDown={stopEditorKeys}
					onKeyDown={stopEditorKeys}
				/>
			) : (
				<div className="compose-html-preview">
					{html.trim() ? (
						<div
							className="compose-html-preview-content"
							dangerouslySetInnerHTML={{ __html: previewHtml }}
						/>
					) : (
						<p className="text-muted-foreground text-xs italic">
							{t("htmlBlock.emptyPreview")}
						</p>
					)}
				</div>
			)}
		</NodeViewWrapper>
	);
}
