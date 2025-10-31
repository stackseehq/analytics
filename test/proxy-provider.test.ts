import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProxyProvider } from "@/providers/proxy/client.js";
import type { ProxyPayload } from "@/providers/proxy/types.js";

describe("ProxyProvider", () => {
	let provider: ProxyProvider;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Mock fetch
		fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
		});
		global.fetch = fetchMock;

		// Mock navigator.sendBeacon
		vi.stubGlobal("navigator", {
			sendBeacon: vi.fn().mockReturnValue(true),
			userAgent: "Mozilla/5.0 Test",
			language: "en-US",
		});

		// Mock window event listeners and properties
		vi.stubGlobal("window", {
			addEventListener: vi.fn(),
			location: {
				pathname: "/test-page",
				href: "https://example.com/test-page",
			},
			screen: {
				width: 1920,
				height: 1080,
			},
			innerWidth: 1440,
			innerHeight: 900,
		});

		// Mock document
		vi.stubGlobal("document", {
			addEventListener: vi.fn(),
			title: "Test Page",
			referrer: "https://referrer.com",
		});

		// Mock Intl
		vi.stubGlobal("Intl", {
			DateTimeFormat: vi.fn().mockReturnValue({
				resolvedOptions: () => ({ timeZone: "America/New_York" }),
			}),
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe("Initialization", () => {
		it("should initialize successfully", async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
			});

			await provider.initialize();
			expect(provider.name).toBe("Proxy");
		});

		it("should not initialize when disabled", async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				enabled: false,
			});

			await provider.initialize();
			// Should not throw
		});

		it("should setup page unload listeners", () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
			});

			expect(window.addEventListener).toHaveBeenCalledWith(
				"beforeunload",
				expect.any(Function),
			);
			expect(document.addEventListener).toHaveBeenCalledWith(
				"visibilitychange",
				expect.any(Function),
			);
		});
	});

	describe("Event Queueing", () => {
		beforeEach(async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: {
					size: 10,
					interval: 5000,
				},
			});
			await provider.initialize();
		});

		it("should queue track events", async () => {
			await provider.track({
				action: "test_event",
				category: "test",
				properties: { foo: "bar" },
			});

			// Should not flush immediately
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("should queue identify events", () => {
			provider.identify("user-123", { email: "user@example.com" });

			// Should not flush immediately
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("should queue pageView events", () => {
			provider.pageView({ path: "/home" });

			// Should not flush immediately
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("should queue reset events", async () => {
			await provider.reset();

			// Should not flush immediately
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});

	describe("Batching - Size Threshold", () => {
		it("should auto-flush when batch size is reached", async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: {
					size: 3,
					interval: 5000,
				},
			});
			await provider.initialize();

			// Add 3 events to trigger flush
			await provider.track({
				action: "event1",
				category: "test",
				properties: {},
			});
			await provider.track({
				action: "event2",
				category: "test",
				properties: {},
			});
			await provider.track({
				action: "event3",
				category: "test",
				properties: {},
			});

			// Give it a moment to flush
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/events",
				expect.objectContaining({
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
				}),
			);

			// Check payload
			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayload;
			expect(payload.events).toHaveLength(3);
			expect(payload.events[0].type).toBe("track");
		});

		it("should handle mixed event types in batch", async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 4 },
			});
			await provider.initialize();

			provider.identify("user-123");
			await provider.track({
				action: "event1",
				category: "test",
				properties: {},
			});
			provider.pageView();
			await provider.reset();

			await new Promise((resolve) => setTimeout(resolve, 10));

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayload;
			expect(payload.events).toHaveLength(4);
			expect(payload.events[0].type).toBe("identify");
			expect(payload.events[1].type).toBe("track");
			expect(payload.events[2].type).toBe("pageView");
			expect(payload.events[3].type).toBe("reset");
		});
	});

	describe("Batching - Time Interval", () => {
		it("should auto-flush after interval", async () => {
			vi.useFakeTimers();

			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: {
					size: 100, // Large size to prevent size-based flush
					interval: 1000,
				},
			});
			await provider.initialize();

			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});

			// Should not flush immediately
			expect(fetchMock).not.toHaveBeenCalled();

			// Fast-forward time
			vi.advanceTimersByTime(1000);

			// Give it a moment to process
			await vi.runAllTimersAsync();

			expect(fetchMock).toHaveBeenCalledTimes(1);

			vi.useRealTimers();
		});
	});

	describe("Manual Flush", () => {
		beforeEach(async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10000 },
			});
			await provider.initialize();
		});

		it("should flush events manually", async () => {
			await provider.track({
				action: "event1",
				category: "test",
				properties: {},
			});
			await provider.track({
				action: "event2",
				category: "test",
				properties: {},
			});

			await provider.flush();

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayload;
			expect(payload.events).toHaveLength(2);
		});

		it("should not flush when queue is empty", async () => {
			await provider.flush();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("should use beacon API when requested", async () => {
			const beaconSpy = vi.spyOn(navigator, "sendBeacon");

			await provider.track({
				action: "event1",
				category: "test",
				properties: {},
			});

			await provider.flush(true);

			expect(beaconSpy).toHaveBeenCalled();
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});

	describe("Context Enrichment", () => {
		beforeEach(async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 1 },
			});
			await provider.initialize();
		});

		it("should enrich context with page info", async () => {
			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayload;
			const trackEvent = payload.events[0];

			if (trackEvent.type === "track") {
				expect(trackEvent.context?.page).toMatchObject({
					path: "/test-page",
					url: "https://example.com/test-page",
					title: "Test Page",
					referrer: "https://referrer.com",
				});
			}
		});

		it("should enrich context with device info", async () => {
			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayload;
			const trackEvent = payload.events[0];

			if (trackEvent.type === "track") {
				expect(trackEvent.context?.device).toMatchObject({
					userAgent: "Mozilla/5.0 Test",
					language: "en-US",
					timezone: "America/New_York",
					screen: {
						width: 1920,
						height: 1080,
					},
					viewport: {
						width: 1440,
						height: 900,
					},
				});
			}
		});

		it("should merge with provided context", async () => {
			await provider.track(
				{
					action: "test_event",
					category: "test",
					properties: {},
				},
				{
					user: {
						userId: "user-123",
					},
				},
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayload;
			const trackEvent = payload.events[0];

			if (trackEvent.type === "track") {
				expect(trackEvent.context?.user?.userId).toBe("user-123");
				expect(trackEvent.context?.page?.path).toBe("/test-page");
			}
		});
	});

	describe("Retry Logic", () => {
		it("should retry on failure with exponential backoff", async () => {
			vi.useFakeTimers();

			// Fail twice, then succeed
			fetchMock
				.mockRejectedValueOnce(new Error("Network error"))
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					statusText: "OK",
				});

			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 1 },
				retry: {
					attempts: 3,
					backoff: "exponential",
					initialDelay: 100,
				},
			});
			await provider.initialize();

			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});

			// First attempt
			await vi.advanceTimersByTimeAsync(10);
			expect(fetchMock).toHaveBeenCalledTimes(1);

			// Second attempt (100ms delay)
			await vi.advanceTimersByTimeAsync(100);
			expect(fetchMock).toHaveBeenCalledTimes(2);

			// Third attempt (200ms delay)
			await vi.advanceTimersByTimeAsync(200);
			expect(fetchMock).toHaveBeenCalledTimes(3);

			vi.useRealTimers();
		});

		it("should use linear backoff when configured", async () => {
			vi.useFakeTimers();

			fetchMock
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					statusText: "OK",
				});

			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 1 },
				retry: {
					attempts: 2,
					backoff: "linear",
					initialDelay: 100,
				},
			});
			await provider.initialize();

			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});

			// First attempt
			await vi.advanceTimersByTimeAsync(10);

			// Second attempt (100ms delay - linear)
			await vi.advanceTimersByTimeAsync(100);
			expect(fetchMock).toHaveBeenCalledTimes(2);

			vi.useRealTimers();
		});

		it("should give up after max retries", async () => {
			const consoleError = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			fetchMock.mockRejectedValue(new Error("Network error"));

			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 1 },
				retry: {
					attempts: 2,
					initialDelay: 1,
				},
			});
			await provider.initialize();

			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});

			// Wait for all retries
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Initial + 2 retries = 3 total attempts
			expect(fetchMock).toHaveBeenCalledTimes(3);
			expect(consoleError).toHaveBeenCalledWith(
				"[Proxy] Failed to send events after retries:",
				expect.any(Error),
			);

			consoleError.mockRestore();
		});
	});

	describe("Custom Headers", () => {
		it("should include custom headers in requests", async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 1 },
				headers: {
					"X-Custom-Header": "custom-value",
					Authorization: "Bearer token",
				},
			});
			await provider.initialize();

			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(fetchMock).toHaveBeenCalledWith(
				"/api/events",
				expect.objectContaining({
					headers: {
						"Content-Type": "application/json",
						"X-Custom-Header": "custom-value",
						Authorization: "Bearer token",
					},
				}),
			);
		});
	});

	describe("Shutdown", () => {
		it("should flush events on shutdown", async () => {
			const beaconMock = vi.fn().mockReturnValue(true);
			vi.stubGlobal("navigator", {
				sendBeacon: beaconMock,
				userAgent: "Mozilla/5.0 Test",
				language: "en-US",
			});

			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100 },
			});
			await provider.initialize();

			await provider.track({
				action: "event1",
				category: "test",
				properties: {},
			});
			await provider.track({
				action: "event2",
				category: "test",
				properties: {},
			});

			// Shutdown calls flush(true) which uses beacon API
			await provider.shutdown();

			// Should use beacon, not fetch
			expect(beaconMock).toHaveBeenCalledTimes(1);
			expect(fetchMock).not.toHaveBeenCalled();

			// Check beacon was called with correct data
			const blobArg = beaconMock.mock.calls[0][1] as Blob;
			const text = await blobArg.text();
			const payload = JSON.parse(text) as ProxyPayload;
			expect(payload.events).toHaveLength(2);
		});
	});

	describe("Disabled Provider", () => {
		it("should not queue events when disabled", async () => {
			provider = new ProxyProvider({
				endpoint: "/api/events",
				enabled: false,
			});
			await provider.initialize();

			await provider.track({
				action: "test_event",
				category: "test",
				properties: {},
			});
			provider.identify("user-123");
			provider.pageView();
			await provider.reset();

			await provider.flush();

			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});
