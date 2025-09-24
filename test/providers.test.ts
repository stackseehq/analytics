import { describe, it, expect } from "vitest";
import * as Providers from "@/providers/index";

describe("@stacksee/analytics/providers exports", () => {
	it("should export all provider classes", () => {
		expect(Providers.BaseAnalyticsProvider).toBeDefined();
		expect(Providers.PostHogClientProvider).toBeDefined();
		expect(Providers.PostHogServerProvider).toBeDefined();
	});
});