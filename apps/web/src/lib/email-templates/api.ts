import { apiRequest } from "@/lib/api/request";
import { apiUrl } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import type { ProblemDetails } from "@/lib/api/client";

export type EmailTemplate = {
	id: string;
	name: string;
	mailboxId: string | null;
	scope: "global" | "mailbox";
	mailboxAddress: string | null;
	createdAt: string;
	updatedAt: string;
};

export type EmailTemplateListResult = {
	items: EmailTemplate[];
	capabilities?: {
		canCreateGlobal: boolean;
	};
};

async function parseProblem(response: Response): Promise<ProblemDetails | undefined> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("json")) {
		return undefined;
	}
	try {
		return (await response.json()) as ProblemDetails;
	} catch {
		return undefined;
	}
}

export async function listComposeTemplates(
	mailboxId: string,
): Promise<EmailTemplate[]> {
	const data = await apiRequest<EmailTemplateListResult>(
		`/templates?mailboxId=${encodeURIComponent(mailboxId)}`,
	);
	return data.items ?? [];
}

export async function listManageableTemplates(): Promise<EmailTemplateListResult> {
	return apiRequest<EmailTemplateListResult>("/templates?manage=1");
}

export async function fetchTemplateContent(
	templateId: string,
	mailboxId: string,
): Promise<string> {
	const response = await fetch(
		apiUrl(
			`/templates/${encodeURIComponent(templateId)}/content?mailboxId=${encodeURIComponent(mailboxId)}`,
		),
		{ credentials: "include" },
	);

	if (!response.ok) {
		const problem = await parseProblem(response);
		throw new ApiError(
			problem?.detail ?? `Request failed with status ${response.status}`,
			problem,
			response.status,
		);
	}

	return response.text();
}

export async function createEmailTemplate(input: {
	name: string;
	mailboxId?: string | null;
	file: File;
}): Promise<EmailTemplate> {
	const formData = new FormData();
	formData.set("name", input.name);
	if (input.mailboxId) {
		formData.set("mailboxId", input.mailboxId);
	}
	formData.set("file", input.file);

	const response = await fetch(apiUrl("/templates"), {
		method: "POST",
		credentials: "include",
		body: formData,
	});

	if (!response.ok) {
		const problem = await parseProblem(response);
		throw new ApiError(
			problem?.detail ?? `Request failed with status ${response.status}`,
			problem,
			response.status,
		);
	}

	return (await response.json()) as EmailTemplate;
}

export async function renameEmailTemplate(
	templateId: string,
	name: string,
): Promise<EmailTemplate> {
	return apiRequest<EmailTemplate>(`/templates/${encodeURIComponent(templateId)}`, {
		method: "PATCH",
		body: JSON.stringify({ name }),
	});
}

export async function deleteEmailTemplate(templateId: string): Promise<void> {
	await apiRequest<void>(`/templates/${encodeURIComponent(templateId)}`, {
		method: "DELETE",
	});
}
