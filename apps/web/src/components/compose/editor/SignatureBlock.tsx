import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SignatureBlock({ editor, deleteNode }: NodeViewProps) {
	const { t } = useTranslation("compose");
	const removeLabel = t("signature.remove");

	return (
		<NodeViewWrapper
			as="div"
			className="compose-signature-block"
			data-compose-signature=""
			data-drag-handle=""
			contentEditable={false}
		>
			{editor.isEditable ? (
				<button
					type="button"
					aria-label={removeLabel}
					title={removeLabel}
					className="compose-signature-remove"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						deleteNode();
					}}
				>
					<X className="size-3.5" />
				</button>
			) : null}
			{/*
			  Content is still in the document (so getHTML serializes it), but the
			  atom + contentEditable=false keep it non-editable in the UI.
			*/}
			<NodeViewContent
				as="div"
				className="compose-signature-content"
				contentEditable={false}
			/>
		</NodeViewWrapper>
	);
}
