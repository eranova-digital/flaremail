import { confirm } from "@inquirer/prompts";

export async function confirmOrYes(yes: boolean, message: string): Promise<void> {
	if (yes) return;
	if (!process.stdin.isTTY) {
		throw new Error("non-interactive session: pass --yes");
	}
	const ok = await confirm({ message, default: false });
	if (!ok) {
		throw new Error("aborted");
	}
}
