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
