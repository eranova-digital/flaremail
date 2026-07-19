import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ReplyQuoteBlock({ node, editor, deleteNode }: NodeViewProps) {
	const { t } = useTranslation("compose");
	const attribution = node.attrs.attribution as string;
	const quotedText = node.attrs.quotedText as string;
	const removeLabel = t("replyQuote.remove");

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
					aria-label={removeLabel}
					title={removeLabel}
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
