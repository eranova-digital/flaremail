/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly API_URL: string;
	readonly API_BEARER_TOKEN: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
