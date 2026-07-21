import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	input: "../core/openapi.yaml",
	output: {
		path: "src/lib/api/generated",
	},
	plugins: [
		"@hey-api/typescript",
		"@hey-api/client-fetch",
		"@hey-api/sdk",
	],
});
