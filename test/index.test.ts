import { describe, it, expect } from "vitest";
import * as Analytics from "@/index";

describe("@stacksee/analytics exports", () => {
	it("should export client analytics functions", () => {
		expect(Analytics.createClientAnalytics).toBeDefined();
		expect(Analytics.getAnalytics).toBeDefined();
		expect(Analytics.trackClient).toBeDefined();
		expect(Analytics.identifyClient).toBeDefined();
		expect(Analytics.pageViewClient).toBeDefined();
		expect(Analytics.pageLeaveClient).toBeDefined();
		expect(Analytics.resetClient).toBeDefined();
	});

	it("should export provider classes (client only)", () => {
		expect(Analytics.BaseAnalyticsProvider).toBeDefined();
		expect(Analytics.PostHogClientProvider).toBeDefined();
		// Note: PostHogServerProvider is now in @stacksee/analytics/providers
	});

	it("should export analytics classes", () => {
		expect(Analytics.BrowserAnalytics).toBeDefined();
	});
});
