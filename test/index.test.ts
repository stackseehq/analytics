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

	it("should export server analytics functions", () => {
		expect(Analytics.createServerAnalytics).toBeDefined();
		expect(Analytics.ServerAnalytics).toBeDefined();
	});

	it("should export provider classes", () => {
		expect(Analytics.BaseAnalyticsProvider).toBeDefined();
		expect(Analytics.PostHogClientProvider).toBeDefined();
		expect(Analytics.PostHogServerProvider).toBeDefined();
	});

	it("should export analytics classes", () => {
		expect(Analytics.BrowserAnalytics).toBeDefined();
	});
});
