export type MimeHeader = {
	key: string;
	value: string;
};

export type MimeMessageContent = {
	from: string;
	to: string;
	cc?: string | null;
	bcc?: string | null;
	subject?: string | null;
	text?: string | null;
	html?: string | null;
	headers?: MimeHeader[];
};
