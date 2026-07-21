import { useTranslation } from "react-i18next";

import { SandboxedHtml } from "@/components/html/SandboxedHtml";

type EmailHtmlBodyProps = {
	html: string;
	/** Prefer light paper for heavily structured HTML (tables/layout emails). */
	preferLightPaper?: boolean;
};

const MESSAGE_BODY_CSS = [
	"body { padding: 0; font-size: 0.875rem; line-height: 1.5; }",
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
export function EmailHtmlBody({ html, preferLightPaper = false }: EmailHtmlBodyProps) {
	const { t } = useTranslation("mail");

	return (
		<SandboxedHtml
			title={t("message.emailTitle")}
			html={html}
			bodyCss={MESSAGE_BODY_CSS}
			adaptToTheme={!preferLightPaper}
			className="message-html-body"
		/>
	);
}
