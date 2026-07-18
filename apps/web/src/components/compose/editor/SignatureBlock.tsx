import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { X } from "lucide-react";

export function SignatureBlock({ editor, deleteNode }: NodeViewProps) {
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
					aria-label="Remove signature"
					title="Remove signature"
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
