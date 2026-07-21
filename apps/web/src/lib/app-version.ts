import packageJson from "../../../../package.json" with { type: "json" };

/** Product version from the monorepo root package.json (release source of truth). */
export const APP_VERSION: string = packageJson.version;
