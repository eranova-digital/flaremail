import { describe, expect, it } from "vitest";

import { rollbackNewThread, storeMessage } from "../src/lib/messages/message-store";

describe("message store", () => {
	it("exports storeMessage and rollbackNewThread", () => {
		expect(typeof storeMessage).toBe("function");
		expect(typeof rollbackNewThread).toBe("function");
	});
});
