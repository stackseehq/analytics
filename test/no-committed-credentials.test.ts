import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live E2E credentials", () => {
	it("requires Pirsch credentials from the environment", () => {
		const source = readFileSync("e2e/test-app/server.js", "utf8");

		expect(/PIRSCH_CLIENT_(?:ID|SECRET)\s*\|\|/.test(source)).toBe(false);
		expect(/client(?:Id|Secret):\s*["'][^"']+["']/.test(source)).toBe(false);
		expect(
			source.includes('requireEnvironmentVariable("PIRSCH_CLIENT_ID")'),
		).toBe(true);
		expect(
			source.includes('requireEnvironmentVariable("PIRSCH_CLIENT_SECRET")'),
		).toBe(true);
	});
});
