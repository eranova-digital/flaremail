import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { X } from "lucide-react";

export function ReplyQuoteBlock({ node, editor, deleteNode }: NodeViewProps) {
	const attribution = node.attrs.attribution as string;
	const quotedText = node.attrs.quotedText as string;

	return (
		<NodeViewWrapper
			as="div"
			className="reply-quote-block group/reply-quote"
			data-reply-quote=""
			contentEditable={false}
		>
			{editor.isEditable ? (
				<button
					type="button"
					aria-label="Remove quoted message"
					title="Remove quoted message"
					className="reply-quote-remove"
					onClick={() => deleteNode()}
				>
					<X className="size-3.5" />
				</button>
			) : null}
			<div className="reply-quote-block-inner">
				<p className="reply-quote-attribution">{attribution}</p>
				<div className="reply-quote-body whitespace-pre-wrap">{quotedText}</div>
			</div>
		</NodeViewWrapper>
	);
}
