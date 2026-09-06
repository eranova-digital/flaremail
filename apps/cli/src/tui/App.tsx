import { Box, Text, useApp, useInput } from "ink";
import React, { useEffect, useState } from "react";

import { applyInfrastructure } from "../apply.js";
import { createCloudflareAdapter } from "../cloudflare.js";
import { confExists, loadConfFile, type Conf } from "../config.js";
import { deploy } from "../deploy.js";
import {
	collectSnapshot,
	evaluateHealth,
	type HealthReport,
} from "../health.js";
import type { RepoPaths } from "../paths.js";
import { sync } from "../sync.js";

type Screen = "home" | "busy";

export function App(props: { paths: RepoPaths }) {
	const { exit } = useApp();
	const [error, setError] = useState<string | null>(null);
	const [log, setLog] = useState<string[]>([]);
	const [report, setReport] = useState<HealthReport | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [conf, setConf] = useState<Conf | null>(null);
	const [screen] = useState<Screen>("home");

	useEffect(() => {
		try {
			if (confExists(props.paths.conf)) {
				setConf(loadConfFile(props.paths.conf));
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [props.paths.conf]);

	async function run(label: string, fn: () => Promise<void>) {
		setBusy(label);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(null);
		}
	}

	function append(line: string) {
		setLog((prev) => [...prev.slice(-20), line]);
	}

	useInput((input, key) => {
		if (busy) return;
		if (input === "q" || key.escape) {
			exit();
			return;
		}
		if (input === "s") {
			void run("sync", async () => {
				const result = sync(props.paths);
				append(`sync ${result.source}`);
				if (confExists(props.paths.conf)) {
					setConf(loadConfFile(props.paths.conf));
				}
			});
			return;
		}
		if (input === "d") {
			void run("doctor", async () => {
				const loaded = loadConf();
				const next = evaluateHealth(
					loaded,
					await collectSnapshot(loaded, createCloudflareAdapter(loaded)),
				);
				setReport(next);
				append(next.healthy ? "healthy" : "unhealthy");
			});
			return;
		}
		if (input === "a") {
			void run("apply", async () => {
				const loaded = loadConf();
				const result = await applyInfrastructure(
					loaded,
					props.paths,
					createCloudflareAdapter(loaded),
					append,
				);
				setConf(loadConfFile(props.paths.conf));
				setReport(result.report);
			});
			return;
		}
		if (input === "p") {
			void run("deploy", async () => {
				const loaded = loadConf();
				await deploy({
					conf: loaded,
					paths: props.paths,
					target: "all",
					log: append,
				});
				append("deploy finished");
			});
		}
	});

	function loadConf(): Conf {
		if (!confExists(props.paths.conf)) {
			throw new Error("No flaremail.conf.jsonc — run flaremail init");
		}
		return loadConfFile(props.paths.conf);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>FlareMail</Text>
			<Text dimColor>{props.paths.conf}</Text>
			{conf ? (
				<Box marginTop={1} flexDirection="column">
					<Text>account  {conf.cloudflare.accountId}</Text>
					<Text>hostname {conf.gate.hostname}</Text>
					<Text>core     {conf.core.workerName}</Text>
					<Text>gate     {conf.gate.workerName}</Text>
					<Text>
						hyperdrive {conf.database.hyperdrive.id || "(none yet)"}
					</Text>
					<Text>r2       {conf.r2.bucketName}</Text>
					<Text>
						mail     {conf.mailDomains.join(", ") || "(none)"}
					</Text>
				</Box>
			) : (
				<Box marginTop={1}>
					<Text color="yellow">No conf. Run flaremail init.</Text>
				</Box>
			)}
			<Box marginTop={1} flexDirection="column">
				<Text bold>health</Text>
				{report ? (
					report.checks.map((check) => (
						<Text key={check.id} color={statusColor(check.status)}>
							{check.status.padEnd(7)} {check.label}: {check.detail}
						</Text>
					))
				) : (
					<Text dimColor>press d to run doctor</Text>
				)}
			</Box>
			{log.length > 0 ? (
				<Box marginTop={1} flexDirection="column">
					<Text bold>log</Text>
					{log.map((line, index) => (
						<Text key={`${index}-${line}`} dimColor>
							{line}
						</Text>
					))}
				</Box>
			) : null}
			{error ? <Text color="red">{error}</Text> : null}
			{busy ? <Text color="cyan">{busy}…</Text> : null}
			<Box marginTop={1}>
				<Text dimColor>
					{screen === "home"
						? "[d]octor  [a]pply  [p]deploy  [s]ync  [q]uit"
						: ""}
				</Text>
			</Box>
		</Box>
	);
}

function statusColor(status: string): string {
	if (status === "ok") return "green";
	if (status === "skip") return "gray";
	if (status === "missing") return "yellow";
	return "red";
}
