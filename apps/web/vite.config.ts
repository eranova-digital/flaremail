import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, __dirname, ["API_"]);
	const proxyTarget = env.API_PROXY_TARGET || "http://localhost:8787";

	return {
		envPrefix: ["VITE_", "API_"],
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
				// email-reply-parser imports Node's "module" builtin for an optional
				// re2 require. Shim it so the browser bundle loads and falls back to
				// native RegExp.
				module: path.resolve(__dirname, "./src/lib/shims/module.ts"),
			},
		},
		server: {
			port: 5173,
			proxy: {
				"/api": {
					target: proxyTarget,
					changeOrigin: true,
					secure: true,
				},
			},
		},
	};
});
