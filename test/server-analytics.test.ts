import { describe, it, expect, beforeEach } from "vitest";
import { createServerAnalytics, type ServerAnalytics } from "@/server";
import { MockAnalyticsProvider } from "./mock-provider";
import type { CreateEventDefinition, EventCollection } from "@/core/events";

// Define test events
const TestEvents = {
	userSignedUp: {
		name: "user_signed_up",
		category: "user",
		properties: {} as {
			userId: string;
			email: string;
			plan: "free" | "pro";
		},
	},
	featureUsed: {
		name: "feature_used",
		category: "engagement",
		properties: {} as {
			featureName: string;
			userId: string;
		},
	},
} as const satisfies EventCollection<
	Record<string, CreateEventDefinition<string>>
>;

describe("Server Analytics", () => {
	let mockProvider: MockAnalyticsProvider;
	let analytics: ServerAnalytics;

	beforeEach(() => {
		mockProvider = new MockAnalyticsProvider({ debug: false, enabled: true });
		analytics = createServerAnalytics({
			providers: [mockProvider],
			debug: false,
			enabled: true,
		});
	});

	it("should initialize providers", () => {
		expect(mockProvider.calls.initialize).toBe(1);
	});

	it("should track events with correct properties", async () => {
		await analytics.track(TestEvents.userSignedUp.name, {
			userId: "user-123",
			email: "test@example.com",
			plan: "pro",
		});

		expect(mockProvider.calls.track).toHaveLength(1);
		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.action).toBe("user_signed_up");
		expect(trackedEvent.event.category).toBe("user");
		expect(trackedEvent.event.properties).toEqual({
			userId: "user-123",
			email: "test@example.com",
			plan: "pro",
		});
	});

	it("should track events with user context", async () => {
		await analytics.track(
			TestEvents.featureUsed.name,
			{
				featureName: "export",
				userId: "user-123",
			},
			{
				userId: "user-123",
				sessionId: "session-456",
				context: {
					page: {
						path: "/api/export",
					},
				},
			},
		);

		expect(mockProvider.calls.track).toHaveLength(1);
		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.userId).toBe("user-123");
		expect(trackedEvent.event.sessionId).toBe("session-456");
		expect(trackedEvent.context?.page?.path).toBe("/api/export");
	});

	it("should identify users", () => {
		analytics.identify("user-123", {
			email: "test@example.com",
			name: "Test User",
			plan: "pro",
		});

		expect(mockProvider.calls.identify).toHaveLength(1);
		expect(mockProvider.calls.identify[0]).toEqual({
			userId: "user-123",
			traits: {
				email: "test@example.com",
				name: "Test User",
				plan: "pro",
			},
		});
	});

	it("should track page views", () => {
		analytics.pageView(
			{
				path: "/dashboard",
				title: "Dashboard",
			},
			{
				context: {
					device: {
						type: "desktop",
						os: "macOS",
					},
				},
			},
		);

		expect(mockProvider.calls.pageView).toHaveLength(1);
		const pageView = mockProvider.calls.pageView[0];
		expect(pageView.properties).toEqual({
			path: "/dashboard",
			title: "Dashboard",
		});
		expect(pageView.context?.device).toEqual({
			type: "desktop",
			os: "macOS",
		});
	});

	it("should handle multiple providers", async () => {
		const mockProvider2 = new MockAnalyticsProvider({ enabled: true });
		const multiAnalytics = createServerAnalytics<{
			userSignedUp: {
				name: "user_signed_up";
				category: "user";
				properties: { userId: string };
			};
		}>({
			providers: [mockProvider, mockProvider2],
			enabled: true,
		});

		await multiAnalytics.track("user_signed_up", { userId: "user-123" });

		expect(mockProvider.calls.track).toHaveLength(1);
		expect(mockProvider2.calls.track).toHaveLength(1);
	});

	it("should respect enabled flag", () => {
		const disabledProvider = new MockAnalyticsProvider({ enabled: false });
		const disabledAnalytics = createServerAnalytics<{
			userSignedUp: {
				name: "user_signed_up";
				category: "user";
				properties: { userId: string };
			};
		}>({
			providers: [disabledProvider],
			enabled: true,
		});

		disabledAnalytics.track("user_signed_up", { userId: "user-123" });

		expect(disabledProvider.calls.track).toHaveLength(0);
	});

	it("should extract category from event name", async () => {
		await analytics.track("custom_action", { data: "test" });

		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.category).toBe("custom");
	});

	it("should use default category for events without underscore", async () => {
		await analytics.track("singleword", { data: "test" });

		const trackedEvent = mockProvider.calls.track[0];
		expect(trackedEvent.event.category).toBe("engagement");
	});

	it("should handle shutdown gracefully", async () => {
		// Add a shutdown method to mock provider
		const shutdownProvider = new MockAnalyticsProvider({
			enabled: true,
		}) as MockAnalyticsProvider & { shutdown: () => Promise<void> };
		let shutdownCalled = false;
		shutdownProvider.shutdown = async () => {
			shutdownCalled = true;
		};

		const analyticsWithShutdown = createServerAnalytics({
			providers: [shutdownProvider],
		});

		await analyticsWithShutdown.shutdown();
		expect(shutdownCalled).toBe(true);
	});
});
