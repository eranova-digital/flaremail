import { dateFnsLocaleFor } from "@/lib/i18n/date-locale";
import { describe, expect, it } from "vitest";

describe("dateFnsLocaleFor", () => {
	it("maps app locales to date-fns locales", () => {
		expect(dateFnsLocaleFor("ja-JP").code).toBe("ja");
		expect(dateFnsLocaleFor("de-DE").code).toBe("de");
		expect(dateFnsLocaleFor("ro-RO").code).toBe("ro");
		expect(dateFnsLocaleFor("zh-CN").code).toBe("zh-CN");
	});

	it("falls back to en-US for unknown tags", () => {
		expect(dateFnsLocaleFor("sv-SE").code).toBe("en-US");
	});
});
