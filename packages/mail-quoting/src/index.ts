export {
	SUBJECT_PREFIX_PATTERN,
	forwardSubject,
	normalizeSubjectForComparison,
	replySubject,
} from "./subject";

export {
	buildForwardBodyHtml,
	buildForwardBodyText,
	buildForwardQuotedHtml,
	buildForwardQuotedText,
} from "./forward-quote";

export type { ReplyQuoteContent, ReplyQuoteParent } from "./reply-quote";
export {
	buildReplyQuoteHtml,
	formatReplyAttribution,
	formatReplyQuotePlainText,
} from "./reply-quote";
