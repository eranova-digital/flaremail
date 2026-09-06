import { describe, expect, it } from "vitest";

import { parsePostgresUrl } from "./secrets.js";

describe("parsePostgresUrl", () => {
	it("parses neon-style URLs", () => {
		const origin = parsePostgresUrl(
			"postgresql://user:p%40ss@ep-foo.us-east-1.aws.neon.tech/neondb?sslmode=require",
		);
		expect(origin).toMatchObject({
			scheme: "postgres",
			host: "ep-foo.us-east-1.aws.neon.tech",
			port: 5432,
			database: "neondb",
			user: "user",
			password: "p@ss",
		});
	});
});
