export function emailTemplateStorageKey(templateId: string): string {
	return `templates/${templateId}.html`;
}
