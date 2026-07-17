import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";

import { db } from "@/db/client";
import * as schema from "@/db/auth-schema";

const flaremailWebUrl =
	process.env.FLAREMAIL_WEB_URL ?? "http://localhost:5173";
const flaremailApiUrl =
	process.env.FLAREMAIL_API_URL ?? "http://localhost:8787";
const userInfoUrl = `${flaremailApiUrl}/api/v1/oauth/userinfo`;

export const auth = betterAuth({
	appName: "3p-demo",
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	secret: process.env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema,
	}),
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: "flaremail",
					clientId: process.env.FLAREMAIL_CLIENT_ID ?? "",
					clientSecret: process.env.FLAREMAIL_CLIENT_SECRET ?? "",
					// Browser hits Flaremail web (Vite proxies /api) so the session cookie applies.
					authorizationUrl: `${flaremailWebUrl}/api/v1/oauth/authorize`,
					// Token + userinfo are server-to-server against the Worker.
					tokenUrl: `${flaremailApiUrl}/api/v1/oauth/token`,
					userInfoUrl,
					issuer: flaremailApiUrl,
					scopes: ["openid", "profile", "email"],
					pkce: true,
					authentication: "post",
					getUserInfo: async (tokens) => {
						if (!tokens.accessToken) {
							return null;
						}
						const response = await fetch(userInfoUrl, {
							headers: {
								Authorization: `Bearer ${tokens.accessToken}`,
							},
						});
						if (!response.ok) {
							return null;
						}
						const profile = (await response.json()) as {
							sub?: string;
							email?: string;
							name?: string;
						};
						if (!profile.sub || !profile.email) {
							return null;
						}
						return {
							id: profile.sub,
							name: profile.name?.trim() || profile.email,
							email: profile.email,
							emailVerified: true,
							image: undefined,
						};
					},
				},
			],
		}),
	],
});
