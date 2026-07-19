import { SandboxedHtml } from "@/components/html/SandboxedHtml";

type EmailHtmlBodyProps = {
	html: string;
};

const MESSAGE_BODY_CSS = [
	"body { padding: 0; font-size: 0.875rem; line-height: 1.5; color: #0a0a0a; }",
	"p { margin: 0 0 0.75em; }",
	"p:empty::before { content: '\\00a0'; }",
	"a { color: #2563eb; text-decoration: underline; }",
	"table { border-collapse: collapse; max-width: 100%; }",
	"td, th { word-break: break-word; }",
	"img { max-width: 100%; height: auto; }",
	"img[data-align='center'] { display: block; margin-left: auto; margin-right: auto; }",
	"img[data-align='right'] { display: block; margin-left: auto; }",
].join("\n");

/** Renders message HTML in a sandboxed iframe (no scripts). */
export function EmailHtmlBody({ html }: EmailHtmlBodyProps) {
	return (
		<SandboxedHtml
			title="Email message"
			html={html}
			bodyCss={MESSAGE_BODY_CSS}
			className="message-html-body min-h-[8rem]"
		/>
	);
}
