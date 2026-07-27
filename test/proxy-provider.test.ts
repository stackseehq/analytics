import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { BrowserAnalytics } from "@/adapters/client/browser-analytics.js";
import { defineEvents } from "@/core/events/index.js";
import type { BaseEvent, EventContext } from "@/core/events/types.js";
import type { TrackInvocation } from "@/index.js";
import { ProxyProvider } from "@/providers/proxy/client.js";
import type { ProxyPayloadV2 } from "@/providers/proxy/types.js";
import { MockAnalyticsProvider } from "./mock-provider.js";

function trackWithInvocation(
	provider: ProxyProvider,
	event: BaseEvent,
	context?: EventContext,
): Promise<void> {
	const invocation: TrackInvocation = {
		input: event.properties,
		inputProvided: Object.hasOwn(event, "properties"),
		occurredAt: event.timestamp ?? 1_234_567_890,
	};
	return provider.track(event, context, invocation);
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

const successfulResponse = {
	ok: true,
	status: 200,
	statusText: "OK",
};

function payloadFromFetch(
	fetchMock: ReturnType<typeof vi.fn>,
	callIndex = 0,
): ProxyPayloadV2 {
	return JSON.parse(fetchMock.mock.calls[callIndex][1].body) as ProxyPayloadV2;
}

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
			document: {},
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
		vi.useRealTimers();
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
			await trackWithInvocation(provider, {
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
			await trackWithInvocation(provider, {
				action: "event1",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
				action: "event2",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
				action: "event3",
				category: "test",
				properties: {},
			});

			await provider.flush();

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
			) as ProxyPayloadV2;
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
			await trackWithInvocation(provider, {
				action: "event1",
				category: "test",
				properties: {},
			});
			provider.pageView();
			await provider.reset();

			await provider.flush();

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayloadV2;
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

			await trackWithInvocation(provider, {
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
			await trackWithInvocation(provider, {
				action: "event1",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
				action: "event2",
				category: "test",
				properties: {},
			});

			await provider.flush();

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayloadV2;
			expect(payload.events).toHaveLength(2);
		});

		it("should not flush when queue is empty", async () => {
			await provider.flush();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("should use beacon API when requested", async () => {
			const beaconSpy = vi.spyOn(navigator, "sendBeacon");

			await trackWithInvocation(provider, {
				action: "event1",
				category: "test",
				properties: {},
			});

			await provider.flush(true);

			expect(beaconSpy).toHaveBeenCalled();
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});

	describe("Delivery semantics", () => {
		it("rejects an exhausted manual flush and retries the exact retained V2 events", async () => {
			const failure = new Error("network unavailable");
			fetchMock
				.mockRejectedValueOnce(failure)
				.mockResolvedValueOnce(successfulResponse);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
				retry: { attempts: 0 },
			});

			await trackWithInvocation(provider, {
				action: "first_event",
				category: "test",
				properties: { sequence: 1 },
			});
			provider.identify("user-2", { plan: "pro" });

			await expect(provider.flush()).rejects.toBe(failure);
			const failedPayload = payloadFromFetch(fetchMock);
			expect(failedPayload).toEqual({
				version: 2,
				events: [
					{
						type: "track",
						name: "first_event",
						input: { sequence: 1 },
						inputProvided: true,
						occurredAt: 1_234_567_890,
						context: expect.any(Object),
					},
					{
						type: "identify",
						userId: "user-2",
						traits: { plan: "pro" },
					},
				],
			});

			await provider.flush();
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(payloadFromFetch(fetchMock, 1)).toEqual(failedPayload);
		});

		it("removes recovered retained events after one successful request", async () => {
			fetchMock
				.mockRejectedValueOnce(new Error("temporary"))
				.mockResolvedValueOnce(successfulResponse);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
				retry: { attempts: 0 },
			});
			await trackWithInvocation(provider, {
				action: "retained_event",
				category: "test",
				properties: {},
			});

			await expect(provider.flush()).rejects.toThrow("temporary");
			await provider.flush();
			await provider.flush();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(payloadFromFetch(fetchMock, 1).events).toHaveLength(1);
			expect(payloadFromFetch(fetchMock, 1).events[0]).toMatchObject({
				type: "track",
				name: "retained_event",
			});
		});

		it("shares the exact promise and request across concurrent flush calls", async () => {
			const request = deferred<typeof successfulResponse>();
			fetchMock.mockReturnValueOnce(request.promise);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
			});
			await trackWithInvocation(provider, {
				action: "shared_flush",
				category: "test",
				properties: {},
			});

			const firstFlush = provider.flush();
			const secondFlush = provider.flush();

			expect(secondFlush).toBe(firstFlush);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("keepalive");
			request.resolve(successfulResponse);
			await firstFlush;
		});

		it("keeps events appended during delivery ordered after the acknowledged prefix", async () => {
			const firstRequest = deferred<typeof successfulResponse>();
			fetchMock
				.mockReturnValueOnce(firstRequest.promise)
				.mockResolvedValueOnce(successfulResponse);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
			});
			await trackWithInvocation(provider, {
				action: "prefix_one",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
				action: "prefix_two",
				category: "test",
				properties: {},
			});

			const firstFlush = provider.flush();
			await trackWithInvocation(provider, {
				action: "appended_one",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
				action: "appended_two",
				category: "test",
				properties: {},
			});
			firstRequest.resolve(successfulResponse);
			await firstFlush;
			await provider.flush();

			expect(
				payloadFromFetch(fetchMock, 0).events.map((event) =>
					event.type === "track" ? event.name : event.type,
				),
			).toEqual(["prefix_one", "prefix_two"]);
			expect(
				payloadFromFetch(fetchMock, 1).events.map((event) =>
					event.type === "track" ? event.name : event.type,
				),
			).toEqual(["appended_one", "appended_two"]);
		});

		it("reports one size-triggered failure while one shared delivery is in flight", async () => {
			vi.useFakeTimers();
			const request = deferred<typeof successfulResponse>();
			const onDeliveryError = vi.fn();
			fetchMock.mockReturnValueOnce(request.promise);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 1, interval: 2000 },
				retry: { attempts: 0 },
				onDeliveryError,
			});

			await trackWithInvocation(provider, {
				action: "threshold_one",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
				action: "threshold_two",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
				action: "threshold_three",
				category: "test",
				properties: {},
			});
			const failure = new TypeError("offline");
			request.reject(failure);
			await vi.advanceTimersByTimeAsync(0);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(onDeliveryError).toHaveBeenCalledTimes(1);
			expect(onDeliveryError).toHaveBeenCalledWith(failure);

			fetchMock.mockResolvedValueOnce(successfulResponse);
			await provider.flush();
			expect(
				payloadFromFetch(fetchMock, 1).events.map((event) =>
					event.type === "track" ? event.name : event.type,
				),
			).toEqual(["threshold_one", "threshold_two", "threshold_three"]);
		});

		it("logs only fixed error-class metadata for an automatic failure without a callback", async () => {
			vi.useFakeTimers();
			const consoleError = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const secretError = new TypeError("error-secret");
			secretError.name = "class-secret";
			fetchMock.mockRejectedValueOnce(secretError);
			provider = new ProxyProvider({
				endpoint: "/api/events?config-secret",
				headers: { Authorization: "header-secret" },
				batch: { size: 1, interval: 2000 },
				retry: { attempts: 0 },
			});

			await trackWithInvocation(provider, {
				action: "event-secret",
				category: "test",
				properties: { value: "payload-secret" },
			});
			await vi.advanceTimersByTimeAsync(0);

			expect(consoleError).toHaveBeenCalledTimes(1);
			expect(consoleError.mock.calls[0]).toHaveLength(1);
			const logged = JSON.stringify(consoleError.mock.calls);
			expect(logged).toContain("TypeError");
			expect(logged).not.toContain("error-secret");
			expect(logged).not.toContain("class-secret");
			expect(logged).not.toContain("event-secret");
			expect(logged).not.toContain("payload-secret");
			expect(logged).not.toContain("config-secret");
			expect(logged).not.toContain("header-secret");

			fetchMock.mockResolvedValueOnce(successfulResponse);
			await provider.flush();
		});

		it("keeps queued identity, event, page, and endpoint data out of debug logs", async () => {
			const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
			provider = new ProxyProvider({
				endpoint: "/api/events?DO_NOT_LOG_ENDPOINT",
				debug: true,
				batch: { size: 100, interval: 10_000 },
			});

			await provider.initialize();
			provider.identify("DO_NOT_LOG_USER_ID", {
				email: "DO_NOT_LOG_EMAIL",
			});
			await trackWithInvocation(
				provider,
				{
					action: "safe_registry_event",
					category: "test",
					properties: { value: "DO_NOT_LOG_PROPERTY" },
				},
				{ page: { path: "/DO_NOT_LOG_CONTEXT" } },
			);
			provider.pageView(
				{ value: "DO_NOT_LOG_PAGE_PROPERTY" },
				{ page: { path: "/DO_NOT_LOG_PAGE_CONTEXT" } },
			);

			const output = JSON.stringify(consoleLog.mock.calls);
			expect(output).toContain("[Proxy] Initialized successfully");
			expect(output).not.toContain("DO_NOT_LOG");
			expect(consoleLog.mock.calls.every((call) => call.length === 1)).toBe(
				true,
			);
			consoleLog.mockRestore();
		});

		it("schedules one retry interval from a failed delivery without spinning", async () => {
			vi.useFakeTimers();
			const firstRequest = deferred<typeof successfulResponse>();
			fetchMock
				.mockReturnValueOnce(firstRequest.promise)
				.mockResolvedValueOnce(successfulResponse);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 2000 },
				retry: { attempts: 0 },
			});
			await trackWithInvocation(provider, {
				action: "retry_on_interval",
				category: "test",
				properties: {},
			});
			const firstFlush = provider.flush();

			await vi.advanceTimersByTimeAsync(1000);
			firstRequest.reject(new Error("offline"));
			await expect(firstFlush).rejects.toThrow("offline");
			await vi.advanceTimersByTimeAsync(1999);
			expect(fetchMock).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(payloadFromFetch(fetchMock, 1)).toEqual(
				payloadFromFetch(fetchMock),
			);
		});

		it("starts the batch interval at the first queued event", async () => {
			vi.useFakeTimers();
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 2000 },
			});

			await trackWithInvocation(provider, {
				action: "at_zero",
				category: "test",
				properties: {},
			});
			await vi.advanceTimersByTimeAsync(900);
			await trackWithInvocation(provider, {
				action: "at_nine_hundred",
				category: "test",
				properties: {},
			});
			await vi.advanceTimersByTimeAsync(900);
			await trackWithInvocation(provider, {
				action: "at_eighteen_hundred",
				category: "test",
				properties: {},
			});
			await vi.advanceTimersByTimeAsync(199);
			expect(fetchMock).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(1);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(payloadFromFetch(fetchMock).events).toHaveLength(3);
		});

		it("starts a new timer for an event appended during a successful in-flight flush", async () => {
			vi.useFakeTimers();
			const firstRequest = deferred<typeof successfulResponse>();
			fetchMock
				.mockReturnValueOnce(firstRequest.promise)
				.mockResolvedValueOnce(successfulResponse);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 2000 },
			});
			await trackWithInvocation(provider, {
				action: "in_flight_prefix",
				category: "test",
				properties: {},
			});

			const firstFlush = provider.flush();
			await trackWithInvocation(provider, {
				action: "appended_during_flight",
				category: "test",
				properties: {},
			});
			firstRequest.resolve(successfulResponse);
			await firstFlush;
			await vi.advanceTimersByTimeAsync(1999);
			expect(fetchMock).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(payloadFromFetch(fetchMock, 1).events).toMatchObject([
				{ type: "track", name: "appended_during_flight" },
			]);
		});

		it("accepts a beacon delivery and removes only its prefix", async () => {
			const beaconSpy = vi.spyOn(navigator, "sendBeacon");
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
			});
			await trackWithInvocation(provider, {
				action: "beacon_event",
				category: "test",
				properties: {},
			});

			await provider.flush(true);
			await trackWithInvocation(provider, {
				action: "after_beacon",
				category: "test",
				properties: {},
			});
			await provider.flush();

			expect(beaconSpy).toHaveBeenCalledTimes(1);
			expect(payloadFromFetch(fetchMock).events).toMatchObject([
				{ type: "track", name: "after_beacon" },
			]);
		});

		it("falls back from a refused beacon to keepalive fetch and retains on failure", async () => {
			const beaconSpy = vi
				.spyOn(navigator, "sendBeacon")
				.mockReturnValue(false);
			const failure = new Error("keepalive failed");
			fetchMock
				.mockRejectedValueOnce(failure)
				.mockResolvedValueOnce(successfulResponse);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				headers: { "X-Proxy": "custom" },
				batch: { size: 100, interval: 10_000 },
				retry: { attempts: 0 },
			});
			await trackWithInvocation(provider, {
				action: "keepalive_event",
				category: "test",
				properties: {},
			});

			await expect(provider.flush(true)).rejects.toBe(failure);
			const firstPayload = payloadFromFetch(fetchMock);
			expect(fetchMock.mock.calls[0][1]).toMatchObject({
				keepalive: true,
				headers: {
					"Content-Type": "application/json",
					"X-Proxy": "custom",
				},
			});
			await provider.flush(true);
			await provider.flush();

			expect(beaconSpy).toHaveBeenCalledTimes(2);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(payloadFromFetch(fetchMock, 1)).toEqual(firstPayload);
		});

		it("uses keepalive fetch for unload delivery when sendBeacon is unavailable", async () => {
			vi.stubGlobal("navigator", {
				userAgent: "Mozilla/5.0 Test",
				language: "en-US",
			});
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
			});
			await trackWithInvocation(provider, {
				action: "no_beacon",
				category: "test",
				properties: {},
			});

			await provider.flush(true);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: true });
		});

		it("observes a rejected page-lifecycle delivery without an unhandled promise", async () => {
			vi.useFakeTimers();
			vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
			const failure = new Error("lifecycle offline");
			const onDeliveryError = vi.fn();
			fetchMock.mockRejectedValueOnce(failure);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 2000 },
				retry: { attempts: 0 },
				onDeliveryError,
			});
			await trackWithInvocation(provider, {
				action: "lifecycle_event",
				category: "test",
				properties: {},
			});
			const beforeUnload = vi
				.mocked(window.addEventListener)
				.mock.calls.find(([type]) => type === "beforeunload")?.[1];
			expect(beforeUnload).toBeTypeOf("function");

			(beforeUnload as EventListener)(new Event("beforeunload"));
			await vi.advanceTimersByTimeAsync(0);

			expect(onDeliveryError).toHaveBeenCalledTimes(1);
			expect(onDeliveryError).toHaveBeenCalledWith(failure);
			fetchMock.mockResolvedValueOnce(successfulResponse);
			await provider.flush(true);
		});

		it("awaits an in-flight request before unload-flushing events queued before shutdown", async () => {
			const firstRequest = deferred<typeof successfulResponse>();
			const beaconSpy = vi.spyOn(navigator, "sendBeacon");
			fetchMock.mockReturnValueOnce(firstRequest.promise);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
			});
			await trackWithInvocation(provider, {
				action: "already_sending",
				category: "test",
				properties: {},
			});
			const firstFlush = provider.flush();
			await trackWithInvocation(provider, {
				action: "queued_before_shutdown",
				category: "test",
				properties: {},
			});

			let shutdownResolved = false;
			const shutdown = provider.shutdown().then(() => {
				shutdownResolved = true;
			});
			await Promise.resolve();
			expect(shutdownResolved).toBe(false);
			expect(beaconSpy).not.toHaveBeenCalled();

			firstRequest.resolve(successfulResponse);
			await firstFlush;
			await shutdown;

			expect(shutdownResolved).toBe(true);
			expect(beaconSpy).toHaveBeenCalledTimes(1);
			const beaconPayload = JSON.parse(
				await (beaconSpy.mock.calls[0][1] as Blob).text(),
			) as ProxyPayloadV2;
			expect(beaconPayload.events).toMatchObject([
				{ type: "track", name: "queued_before_shutdown" },
			]);
		});

		it("rejects shutdown with failed events retained", async () => {
			vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
			const failure = new Error("shutdown transport failed");
			fetchMock
				.mockRejectedValueOnce(failure)
				.mockResolvedValueOnce(successfulResponse);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
				retry: { attempts: 0 },
			});
			await trackWithInvocation(provider, {
				action: "shutdown_retained",
				category: "test",
				properties: {},
			});

			await expect(provider.shutdown()).rejects.toBe(failure);
			await provider.flush(true);

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(payloadFromFetch(fetchMock, 1)).toEqual(
				payloadFromFetch(fetchMock),
			);
		});

		it("rejects every enqueue after shutdown begins without leaving a request unresolved", async () => {
			const request = deferred<typeof successfulResponse>();
			fetchMock.mockReturnValueOnce(request.promise);
			provider = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10_000 },
			});
			await trackWithInvocation(provider, {
				action: "before_shutdown",
				category: "test",
				properties: {},
			});
			const flush = provider.flush();
			const shutdown = provider.shutdown();
			const shutDownMessage = "ProxyProvider has been shut down";

			expect(() => provider.identify("late-user")).toThrow(shutDownMessage);
			expect(() => provider.pageView()).toThrow(shutDownMessage);
			await expect(
				trackWithInvocation(provider, {
					action: "late_track",
					category: "test",
					properties: {},
				}),
			).rejects.toThrow(shutDownMessage);
			await expect(provider.reset()).rejects.toThrow(shutDownMessage);

			request.resolve(successfulResponse);
			await flush;
			await shutdown;
			expect(fetchMock).toHaveBeenCalledTimes(1);
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
			await trackWithInvocation(provider, {
				action: "test_event",
				category: "test",
				properties: {},
			});

			await provider.flush();

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayloadV2;
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
			await trackWithInvocation(provider, {
				action: "test_event",
				category: "test",
				properties: {},
			});

			await provider.flush();

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayloadV2;
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

		it("should preserve allowlisted provided context fields", async () => {
			await trackWithInvocation(
				provider,
				{
					action: "test_event",
					category: "test",
					properties: {},
				},
				{
					user: {
						userId: "user-123",
					},
					server: {
						requestId: "forged-request",
					},
					page: {
						path: "/provided",
					},
					utm: {
						source: "newsletter",
					},
					device: {
						type: "mobile",
						ip: "203.0.113.5",
					},
				},
			);

			await provider.flush();

			const payload = JSON.parse(
				fetchMock.mock.calls[0][1].body,
			) as ProxyPayloadV2;
			const trackEvent = payload.events[0];

			if (trackEvent.type === "track") {
				expect(trackEvent.context).toMatchObject({
					page: { path: "/provided" },
					utm: { source: "newsletter" },
					device: { type: "mobile" },
				});
				expect(trackEvent.context).not.toHaveProperty("user");
				expect(trackEvent.context).not.toHaveProperty("server");
				expect(trackEvent.context).not.toHaveProperty("device.ip");
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

			await trackWithInvocation(provider, {
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

			await trackWithInvocation(provider, {
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
			vi.useFakeTimers();
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

			await trackWithInvocation(provider, {
				action: "test_event",
				category: "test",
				properties: {},
			});

			await vi.advanceTimersByTimeAsync(1);
			await vi.advanceTimersByTimeAsync(2);

			// Initial + 2 retries = 3 total attempts
			expect(fetchMock).toHaveBeenCalledTimes(3);
			expect(consoleError).toHaveBeenCalledWith(
				"[Proxy] Automatic delivery failed (Error)",
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

			await trackWithInvocation(provider, {
				action: "test_event",
				category: "test",
				properties: {},
			});

			await provider.flush();

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

			await trackWithInvocation(provider, {
				action: "event1",
				category: "test",
				properties: {},
			});
			await trackWithInvocation(provider, {
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
			const payload = JSON.parse(text) as ProxyPayloadV2;
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

			await trackWithInvocation(provider, {
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

	describe("V2 trust boundary", () => {
		it("sends raw registry input after async validation while normal providers receive transformed properties", async () => {
			const proxy = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10000 },
			});
			const normalProvider = new MockAnalyticsProvider();
			let markValidationStarted!: () => void;
			let releaseValidation!: () => void;
			const validationStarted = new Promise<void>((resolve) => {
				markValidationStarted = resolve;
			});
			const validationGate = new Promise<void>((resolve) => {
				releaseValidation = resolve;
			});
			const asyncTransform: StandardSchemaV1<
				{ amount: string },
				{ amount: number }
			> = {
				"~standard": {
					version: 1,
					vendor: "trakoo-test",
					validate: async (input) => {
						markValidationStarted();
						await validationGate;
						return {
							value: {
								amount: Number((input as { amount: string }).amount),
							},
						};
					},
				},
			};
			const events = defineEvents({
				purchaseCompleted: {
					name: "purchase_completed",
					category: "conversion",
					properties: asyncTransform,
				},
			});
			const analytics = new BrowserAnalytics({
				events,
				providers: [proxy, normalProvider],
				validation: { onFailure: "throw" },
			});

			const trackPromise = analytics.track("purchase_completed", {
				amount: "49",
			});
			await validationStarted;
			expect(fetchMock).not.toHaveBeenCalled();
			expect(normalProvider.calls.track).toHaveLength(0);
			releaseValidation();
			await trackPromise;
			await proxy.flush();

			const payload = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<
				string,
				unknown
			>;
			const [wireEvent] = payload.events as Array<Record<string, unknown>>;
			expect(payload.version).toBe(2);
			expect(wireEvent).toMatchObject({
				type: "track",
				name: "purchase_completed",
				input: { amount: "49" },
				inputProvided: true,
			});
			expect(normalProvider.calls.track[0].event.properties).toEqual({
				amount: 49,
			});
		});

		it("serializes only safe client context fields", async () => {
			const proxy = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10000 },
			});
			const events = defineEvents({
				testEvent: {
					name: "test_event",
					category: "engagement",
					properties: z.object({ value: z.string() }),
				},
			});
			const analytics = new BrowserAnalytics({
				events,
				providers: [proxy],
				defaultContext: {
					server: { requestId: "forged-request" },
					device: { ip: "203.0.113.9" },
				},
			});
			analytics.identify("forged-user", {
				email: "forged@example.com",
			});

			await analytics.track("test_event", { value: "safe" });
			await proxy.flush();

			const serialized = fetchMock.mock.calls[0][1].body as string;
			const payload = JSON.parse(serialized) as {
				version?: number;
				events: Array<Record<string, unknown>>;
			};
			const wireEvent = payload.events.find(
				(event) => event.type === "track",
			) as Record<string, unknown>;
			const serializedTrack = JSON.stringify(wireEvent);
			expect(payload.version).toBe(2);
			expect(wireEvent).not.toHaveProperty("userId");
			expect(wireEvent.context).not.toHaveProperty("user");
			expect(wireEvent.context).not.toHaveProperty("server");
			expect(wireEvent.context).not.toHaveProperty("device.ip");
			expect(serializedTrack).not.toContain("forged-user");
			expect(serializedTrack).not.toContain("forged@example.com");
			expect(serializedTrack).not.toContain("forged-request");
			expect(serializedTrack).not.toContain("203.0.113.9");
		});

		it("rejects direct track calls that lack raw invocation metadata", async () => {
			const proxy = new ProxyProvider({
				endpoint: "/api/events",
				batch: { size: 100, interval: 10000 },
			});

			await expect(
				proxy.track({
					action: "purchase_completed",
					category: "conversion",
					properties: { amount: 49 },
				}),
			).rejects.toThrow(
				"ProxyProvider.track must be called through BrowserAnalytics so raw event input is available",
			);
		});
	});
});
