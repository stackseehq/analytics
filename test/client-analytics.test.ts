/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MockAnalyticsProvider } from "./mock-provider";
import type { CreateEventDefinition, EventCollection } from "@/core/events";
import { createClientAnalytics, getAnalytics } from "@/client";
import { BrowserAnalytics } from "@/adapters/client/browser-analytics";

// Mock window.location
Object.defineProperty(window, "location", {
	value: {
		pathname: "/test-page",
		href: "http://localhost:3000/test-page",
	},
	writable: true,
});

// Define test events
const TestEvents = {
	pageViewed: {
		name: "page_viewed",
		category: "navigation",
		properties: {} as {
			path: string;
			title: string;
			referrer?: string;
		},
	},
	buttonClicked: {
		name: "button_clicked",
		category: "engagement",
		properties: {} as {
			buttonId: string;
			label: string;
		},
	},
} as const satisfies EventCollection<
	Record<string, CreateEventDefinition<string>>
>;

describe("Client Analytics", () => {
	let mockProvider: MockAnalyticsProvider;
	let analytics: BrowserAnalytics;

	beforeEach(async () => {
		// Reset modules to clear singleton
		vi.resetModules();

		mockProvider = new MockAnalyticsProvider({ debug: false, enabled: true });
		analytics = await createClientAnalytics({
			providers: [mockProvider],
			debug: false,
			enabled: true,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should initialize providers", () => {
		expect(mockProvider.calls.initialize).toBe(1);
	});

	it("should track events with browser context", () => {
		analytics.track(TestEvents.pageViewed.name, {
			path: "/dashboard",
			title: "Dashboard",
		});

		expect(mockProvider.calls.track).toHaveLength(1);
		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.action).toBe("page_viewed");
		expect(trackedEvent.event.category).toBe("page");
		expect(trackedEvent.context?.page?.path).toBe("/test-page");
	});

	it("should generate session ID", () => {
		analytics.track(TestEvents.buttonClicked.name, {
			buttonId: "submit-btn",
			label: "Submit",
		});

		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.sessionId).toBeDefined();
		expect(trackedEvent.event.sessionId).toMatch(/^\d+-[a-z0-9]{9}$/);
	});

	it("should identify users and include userId in events", () => {
		analytics.identify("user-123", {
			email: "test@example.com",
			name: "Test User",
		});

		expect(mockProvider.calls.identify).toHaveLength(1);
		expect(mockProvider.calls.identify[0]).toEqual({
			userId: "user-123",
			traits: {
				email: "test@example.com",
				name: "Test User",
			},
		});

		// Track event after identify
		analytics.track("test_event", { test: true });
		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.userId).toBe("user-123");
	});

	it("should track page views with updated context", () => {
		analytics.page({
			customProp: "value",
		});

		expect(mockProvider.calls.page).toHaveLength(1);
		const pageView = mockProvider.calls.page[0];
		expect(pageView.properties).toEqual({
			customProp: "value",
		});
		expect(pageView.context?.page?.path).toBe("/test-page");
	});

	it("should reset user session", () => {
		// Identify user first
		analytics.identify("user-123", { name: "Test" });

		// Get initial session ID
		analytics.track("before_reset", {});
		const beforeReset = mockProvider.calls.track[0];
		const initialSessionId = beforeReset.event.sessionId;

		// Reset
		analytics.reset();
		expect(mockProvider.calls.reset).toBe(1);

		// Track after reset
		analytics.track("after_reset", {});
		const afterReset = mockProvider.calls.track[1];

		// Should have new session ID and no user ID
		expect(afterReset.event.sessionId).not.toBe(initialSessionId);
		expect(afterReset.event.userId).toBeUndefined();
	});

	it("should update context", () => {
		analytics.updateContext({
			campaign: {
				source: "google",
				medium: "cpc",
				name: "summer-sale",
			},
		});

		analytics.track("test_event", {});
		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.context?.campaign).toEqual({
			source: "google",
			medium: "cpc",
			name: "summer-sale",
		});
	});

	it("should handle multiple providers", async () => {
		// Since we already have an instance with mockProvider, let's test that multiple providers work
		// by checking the initial setup
		const mockProvider1 = new MockAnalyticsProvider({ enabled: true });
		const mockProvider2 = new MockAnalyticsProvider({ enabled: true });

		// Reset modules to ensure clean state
		vi.resetModules();
		const { createClientAnalytics: freshCreateClientAnalytics } = await import(
			"../src/client"
		);

		const multiAnalytics = await freshCreateClientAnalytics({
			providers: [mockProvider1, mockProvider2],
			enabled: true,
		});

		multiAnalytics.track("test_event", { test: true });

		// Both providers should have track calls
		expect(mockProvider1.calls.track).toHaveLength(1);
		expect(mockProvider2.calls.track).toHaveLength(1);
	});

	it("should warn if tracking before initialization", () => {
		const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// Create analytics without initializing
		const uninitializedAnalytics = new BrowserAnalytics({
			providers: [mockProvider],
		});

		uninitializedAnalytics.track("test_event", {});

		expect(consoleSpy).toHaveBeenCalledWith(
			"[Analytics] Not initialized. Call initialize() first.",
		);

		consoleSpy.mockRestore();
	});

	it("should extract category from event name", () => {
		analytics.track("custom_action", { data: "test" });

		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.category).toBe("custom");
	});

	it("should use convenience functions", () => {
		// These functions use the singleton instance
		const analyticsInstance = getAnalytics();
		expect(analyticsInstance).toBe(analytics);
	});
});
