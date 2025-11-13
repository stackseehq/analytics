/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockAnalyticsProvider } from "./mock-provider";
import { createClientAnalytics, resetAnalyticsInstance } from "@/client";
import { createServerAnalytics } from "@/server";
import type { BrowserAnalytics } from "@/adapters/client/browser-analytics";
import type { ServerAnalytics } from "@/adapters/server/server-analytics";

// Mock window.location for client tests
Object.defineProperty(window, "location", {
	value: {
		pathname: "/test-page",
		href: "http://localhost:3000/test-page",
	},
	writable: true,
});

describe("Provider Routing - Client", () => {
	let provider1: MockAnalyticsProvider;
	let provider2: MockAnalyticsProvider;
	let provider3: MockAnalyticsProvider;
	let analytics: BrowserAnalytics;

	beforeEach(() => {
		resetAnalyticsInstance();
		provider1 = new MockAnalyticsProvider({ debug: false, enabled: true });
		provider2 = new MockAnalyticsProvider({ debug: false, enabled: true });
		provider3 = new MockAnalyticsProvider({ debug: false, enabled: true });
		provider1.name = "Provider1";
		provider2.name = "Provider2";
		provider3.name = "Provider3";
	});

	afterEach(() => {
		provider1.clearCalls();
		provider2.clearCalls();
		provider3.clearCalls();
	});

	it("should call all methods on simple provider (default behavior)", async () => {
		analytics = createClientAnalytics({
			providers: [provider1],
		});

		await analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();
		analytics.reset();

		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);
		expect(provider1.calls.pageView).toHaveLength(1);
		expect(provider1.calls.pageLeave).toHaveLength(1);
		expect(provider1.calls.reset).toBe(1);
	});

	it("should only call specified methods with 'methods' option", async () => {
		analytics = createClientAnalytics({
			providers: [
				{
					provider: provider1,
					methods: ["track", "identify"],
				},
			],
		});

		await analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();
		analytics.reset();

		// Should call
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);

		// Should NOT call
		expect(provider1.calls.pageView).toHaveLength(0);
		expect(provider1.calls.pageLeave).toHaveLength(0);
		expect(provider1.calls.reset).toBe(0);
	});

	it("should skip specified methods with 'exclude' option", async () => {
		analytics = createClientAnalytics({
			providers: [
				{
					provider: provider1,
					exclude: ["pageView", "pageLeave"],
				},
			],
		});

		await analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();
		analytics.reset();

		// Should call
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);
		expect(provider1.calls.reset).toBe(1);

		// Should NOT call
		expect(provider1.calls.pageView).toHaveLength(0);
		expect(provider1.calls.pageLeave).toHaveLength(0);
	});

	it("should handle mixed provider configurations", async () => {
		analytics = createClientAnalytics({
			providers: [
				// Simple provider - gets all methods
				provider1,
				// Only track and identify
				{
					provider: provider2,
					methods: ["track", "identify"],
				},
				// Everything except pageView
				{
					provider: provider3,
					exclude: ["pageView"],
				},
			],
		});

		await analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();
		analytics.reset();

		// Provider 1 - all methods
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);
		expect(provider1.calls.pageView).toHaveLength(1);
		expect(provider1.calls.pageLeave).toHaveLength(1);
		expect(provider1.calls.reset).toBe(1);

		// Provider 2 - only track and identify
		expect(provider2.calls.initialize).toBe(1);
		expect(provider2.calls.identify).toHaveLength(1);
		expect(provider2.calls.track).toHaveLength(1);
		expect(provider2.calls.pageView).toHaveLength(0);
		expect(provider2.calls.pageLeave).toHaveLength(0);
		expect(provider2.calls.reset).toBe(0);

		// Provider 3 - all except pageView
		expect(provider3.calls.initialize).toBe(1);
		expect(provider3.calls.identify).toHaveLength(1);
		expect(provider3.calls.track).toHaveLength(1);
		expect(provider3.calls.pageView).toHaveLength(0);
		expect(provider3.calls.pageLeave).toHaveLength(1);
		expect(provider3.calls.reset).toBe(1);
	});

	it("should prefer 'methods' over 'exclude' when both are specified", async () => {
		// Mock console.warn to capture the warning
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		analytics = createClientAnalytics({
			providers: [
				{
					provider: provider1,
					methods: ["track"],
					exclude: ["pageView"], // Should be ignored
				},
			],
		});

		await analytics.initialize();
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();

		// Should use 'methods' config
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.track).toHaveLength(1);
		expect(provider1.calls.pageView).toHaveLength(0);

		// Should warn about conflicting config
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("both 'methods' and 'exclude'"),
		);

		warnSpy.mockRestore();
	});

	it("should handle empty 'methods' array", async () => {
		analytics = createClientAnalytics({
			providers: [
				{
					provider: provider1,
					methods: [],
				},
			],
		});

		await analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();

		// Initialize is always called, but no other methods
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(0);
		expect(provider1.calls.track).toHaveLength(0);
		expect(provider1.calls.pageView).toHaveLength(0);
	});

	it("should handle empty 'exclude' array", async () => {
		analytics = createClientAnalytics({
			providers: [
				{
					provider: provider1,
					exclude: [],
				},
			],
		});

		await analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();

		// All methods should be called
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);
		expect(provider1.calls.pageView).toHaveLength(1);
	});
});

describe("Provider Routing - Server", () => {
	let provider1: MockAnalyticsProvider;
	let provider2: MockAnalyticsProvider;
	let provider3: MockAnalyticsProvider;
	let analytics: ServerAnalytics;

	beforeEach(() => {
		provider1 = new MockAnalyticsProvider({ debug: false, enabled: true });
		provider2 = new MockAnalyticsProvider({ debug: false, enabled: true });
		provider3 = new MockAnalyticsProvider({ debug: false, enabled: true });
		provider1.name = "Provider1";
		provider2.name = "Provider2";
		provider3.name = "Provider3";
	});

	afterEach(() => {
		provider1.clearCalls();
		provider2.clearCalls();
		provider3.clearCalls();
	});

	it("should call all methods on simple provider (default behavior)", async () => {
		analytics = createServerAnalytics({
			providers: [provider1],
		});

		analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();

		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);
		expect(provider1.calls.pageView).toHaveLength(1);
		expect(provider1.calls.pageLeave).toHaveLength(1);
	});

	it("should only call specified methods with 'methods' option", async () => {
		analytics = createServerAnalytics({
			providers: [
				{
					provider: provider1,
					methods: ["track", "identify"],
				},
			],
		});

		analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();

		// Should call
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);

		// Should NOT call
		expect(provider1.calls.pageView).toHaveLength(0);
		expect(provider1.calls.pageLeave).toHaveLength(0);
	});

	it("should skip specified methods with 'exclude' option", async () => {
		analytics = createServerAnalytics({
			providers: [
				{
					provider: provider1,
					exclude: ["pageView", "pageLeave"],
				},
			],
		});

		analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();

		// Should call
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);

		// Should NOT call
		expect(provider1.calls.pageView).toHaveLength(0);
		expect(provider1.calls.pageLeave).toHaveLength(0);
	});

	it("should handle mixed provider configurations", async () => {
		analytics = createServerAnalytics({
			providers: [
				// Simple provider - gets all methods
				provider1,
				// Only track and identify
				{
					provider: provider2,
					methods: ["track", "identify"],
				},
				// Everything except pageView
				{
					provider: provider3,
					exclude: ["pageView"],
				},
			],
		});

		analytics.initialize();
		analytics.identify("user-123");
		await analytics.track("test_event", { foo: "bar" });
		analytics.pageView();
		analytics.pageLeave();

		// Provider 1 - all methods
		expect(provider1.calls.initialize).toBe(1);
		expect(provider1.calls.identify).toHaveLength(1);
		expect(provider1.calls.track).toHaveLength(1);
		expect(provider1.calls.pageView).toHaveLength(1);
		expect(provider1.calls.pageLeave).toHaveLength(1);

		// Provider 2 - only track and identify
		expect(provider2.calls.initialize).toBe(1);
		expect(provider2.calls.identify).toHaveLength(1);
		expect(provider2.calls.track).toHaveLength(1);
		expect(provider2.calls.pageView).toHaveLength(0);
		expect(provider2.calls.pageLeave).toHaveLength(0);

		// Provider 3 - all except pageView
		expect(provider3.calls.initialize).toBe(1);
		expect(provider3.calls.identify).toHaveLength(1);
		expect(provider3.calls.track).toHaveLength(1);
		expect(provider3.calls.pageView).toHaveLength(0);
		expect(provider3.calls.pageLeave).toHaveLength(1);
	});
});
