import { spawn } from "node:child_process";

export type SpawnResult = {
	status: number;
	stdout: string;
	stderr: string;
};

export function runCommand(
	command: string,
	args: string[],
	options: {
		cwd: string;
		env?: NodeJS.ProcessEnv;
		stdio?: "inherit" | "pipe";
	},
): Promise<SpawnResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: { ...process.env, ...options.env },
			shell: process.platform === "win32",
			stdio: options.stdio === "pipe" ? ["ignore", "pipe", "pipe"] : "inherit",
		});
		let stdout = "";
		let stderr = "";
		if (child.stdout) {
			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (chunk: string) => {
				stdout += chunk;
			});
		}
		if (child.stderr) {
			child.stderr.setEncoding("utf8");
			child.stderr.on("data", (chunk: string) => {
				stderr += chunk;
			});
		}
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (signal) {
				reject(new Error(`${command} exited via ${signal}`));
				return;
			}
			resolve({ status: code ?? 1, stdout, stderr });
		});
	});
}

export async function runOrThrow(
	command: string,
	args: string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<void> {
	const result = await runCommand(command, args, {
		...options,
		stdio: "inherit",
	});
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
	}
}
