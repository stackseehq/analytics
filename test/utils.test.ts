import { describe, it, expect } from "vitest";
import { isBrowser, isNode, isSSR } from "@/utils/environment.js";

describe("Environment Utilities", () => {
	it("should detect Node.js environment correctly", () => {
		expect(isNode()).toBe(true);
		expect(isBrowser()).toBe(false);
		expect(isSSR()).toBe(true);
	});

	it("should handle browser environment detection", () => {
		// In a Node.js test environment, browser detection should be false
		expect(isBrowser()).toBe(false);
	});

	it("should handle SSR detection", () => {
		// In a Node.js test environment, SSR should be true
		expect(isSSR()).toBe(true);
	});
});
