// biome-ignore lint/suspicious/noExplicitAny: Test file needs type assertions for extended context fields
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	ingestProxyEvents,
	createProxyHandler,
} from "@/providers/proxy/server.js";
import { createServerAnalytics } from "@/server.js";
import { MockAnalyticsProvider } from "./mock-provider.js";
import type { ProxyPayload } from "@/providers/proxy/types.js";

describe("Proxy Server Ingestion", () => {
	let serverAnalytics: ReturnType<typeof createServerAnalytics>;
	let mockProvider: MockAnalyticsProvider;

	beforeEach(() => {
		mockProvider = new MockAnalyticsProvider();
		serverAnalytics = createServerAnalytics({
			providers: [mockProvider],
		});
		serverAnalytics.initialize();
	});

	describe("ingestProxyEvents", () => {
		it("should process track events", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "button_clicked",
							category: "engagement",
							properties: { buttonId: "signup-cta" },
						},
						context: {
							page: {
								path: "/pricing",
							},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect(mockProvider.calls.track).toHaveLength(1);
			expect(mockProvider.calls.track[0].event.action).toBe("button_clicked");
			expect(mockProvider.calls.track[0].event.properties?.buttonId).toBe(
				"signup-cta",
			);
		});

		it("should process identify events", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "identify",
						userId: "user-123",
						traits: {
							email: "user@example.com",
							plan: "pro",
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect(mockProvider.calls.identify).toHaveLength(1);
			expect(mockProvider.calls.identify[0].userId).toBe("user-123");
			expect(mockProvider.calls.identify[0].traits?.email).toBe(
				"user@example.com",
			);
		});

		it("should process pageView events", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "pageView",
						properties: {
							experiment: "v2",
						},
						context: {
							page: {
								path: "/home",
							},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect(mockProvider.calls.pageView).toHaveLength(1);
			expect(mockProvider.calls.pageView[0].properties?.experiment).toBe("v2");
		});

		it("should process reset events (no-op on server)", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "reset",
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			// Reset is a client-side concept, so it's a no-op on server
			expect(mockProvider.calls.reset).toBe(0);
		});

		it("should process multiple events in batch", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "identify",
						userId: "user-123",
					},
					{
						type: "track",
						event: {
							action: "event1",
							category: "test",
							properties: {},
						},
					},
					{
						type: "pageView",
					},
					{
						type: "track",
						event: {
							action: "event2",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect(mockProvider.calls.identify).toHaveLength(1);
			expect(mockProvider.calls.track).toHaveLength(2);
			expect(mockProvider.calls.pageView).toHaveLength(1);
		});

		it("should extract IP from standard headers", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test_event",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				headers: {
					"X-Forwarded-For": "1.2.3.4, 5.6.7.8",
				},
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			// Check that IP was enriched in context (use type assertion for extended field)
			expect((mockProvider.calls.track[0].context?.device as any)?.ip).toBe("1.2.3.4");
		});

		it("should extract IP from X-Real-IP header", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test_event",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				headers: {
					"X-Real-IP": "9.8.7.6",
				},
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect((mockProvider.calls.track[0].context?.device as any)?.ip).toBe("9.8.7.6");
		});

		it("should extract IP from Cloudflare header", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test_event",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				headers: {
					"CF-Connecting-IP": "1.1.1.1",
				},
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect((mockProvider.calls.track[0].context?.device as any)?.ip).toBe("1.1.1.1");
		});

		it("should use custom IP extractor", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test_event",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				headers: {
					"X-Custom-IP": "10.0.0.1",
				},
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics, {
				extractIp: (req) => req.headers.get("x-custom-ip") || undefined,
			});

			expect((mockProvider.calls.track[0].context?.device as any)?.ip).toBe("10.0.0.1");
		});

		it("should enrich context with custom data", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test_event",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics, {
				enrichContext: (req) => ({
					server: {
						region: "us-east-1",
						version: "1.0.0",
					},
					request: {
						method: req.method,
					},
				}),
			});

			const context = mockProvider.calls.track[0].context as any;
			expect(context?.server).toEqual({
				region: "us-east-1",
				version: "1.0.0",
			});
			expect(context?.request).toEqual({
				method: "POST",
			});
		});

		it("should handle errors gracefully", async () => {
			const consoleError = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify({ invalid: "payload" }),
			});

			await expect(
				ingestProxyEvents(request, serverAnalytics),
			).rejects.toThrow();

			expect(consoleError).toHaveBeenCalled();
			consoleError.mockRestore();
		});

		it("should call custom error handler", async () => {
			const onError = vi.fn();

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify({ invalid: "payload" }),
			});

			await expect(
				ingestProxyEvents(request, serverAnalytics, { onError }),
			).rejects.toThrow();

			expect(onError).toHaveBeenCalled();
		});

		it("should handle individual event errors without stopping batch", async () => {
			const onError = vi.fn();

			// Create a provider that throws on identify
			const errorProvider = new MockAnalyticsProvider();
			errorProvider.identify = () => {
				throw new Error("Identify failed");
			};

			const analytics = createServerAnalytics({
				providers: [errorProvider],
			});
			analytics.initialize();

			const payload: ProxyPayload = {
				events: [
					{
						type: "identify",
						userId: "user-123",
					},
					{
						type: "track",
						event: {
							action: "test",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, analytics, { onError });

			// Error handler should be called for the failed identify
			expect(onError).toHaveBeenCalledWith(expect.any(Error));
			// But track should still succeed
			expect(errorProvider.calls.track).toHaveLength(1);
		});

		it("should handle unknown event types", async () => {
			const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

			const payload = {
				events: [
					{
						type: "unknown_type",
						data: "something",
					},
				],
			} as unknown as ProxyPayload;

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect(consoleWarn).toHaveBeenCalledWith(
				"[Proxy] Unknown event type:",
				expect.any(Object),
			);

			consoleWarn.mockRestore();
		});

		it("should preserve client-side context", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test_event",
							category: "test",
							properties: {},
						},
						context: {
							page: {
								path: "/test",
								title: "Test Page",
							},
							device: {
								...(({
									userAgent: "Mozilla/5.0",
									language: "en-US",
								} as any)),
							},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			const context = mockProvider.calls.track[0].context;
			expect(context?.page?.path).toBe("/test");
			expect(context?.page?.title).toBe("Test Page");
			expect((context?.device as any)?.userAgent).toBe("Mozilla/5.0");
			expect((context?.device as any)?.language).toBe("en-US");
		});
	});

	describe("createProxyHandler", () => {
		it("should create a working request handler", async () => {
			const handler = createProxyHandler(serverAnalytics);

			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test_event",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			const response = await handler(request);

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("OK");
			expect(mockProvider.calls.track).toHaveLength(1);
		});

		it("should return 500 on error", async () => {
			const consoleError = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			const handler = createProxyHandler(serverAnalytics);

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: "invalid json",
			});

			const response = await handler(request);

			expect(response.status).toBe(500);
			expect(await response.text()).toBe("Internal Server Error");

			consoleError.mockRestore();
		});

		it("should pass through config options", async () => {
			const onError = vi.fn();
			const handler = createProxyHandler(serverAnalytics, { onError });

			const request = new Request("http://localhost/api/events", {
				method: "POST",
				body: "invalid json",
			});

			await handler(request);

			expect(onError).toHaveBeenCalled();
		});
	});

	describe("Serverless Compatibility", () => {
		it("should work with standard Request/Response interface", async () => {
			// This test verifies that we only use standard Web APIs
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test",
							category: "test",
							properties: {},
						},
					},
				],
			};

			// Standard Request (works in Vercel, Netlify, Cloudflare Workers, etc.)
			const request = new Request("https://example.com/api/events", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Forwarded-For": "1.2.3.4",
				},
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect(mockProvider.calls.track).toHaveLength(1);
		});

		it("should work with headers as Headers object", async () => {
			const payload: ProxyPayload = {
				events: [
					{
						type: "track",
						event: {
							action: "test",
							category: "test",
							properties: {},
						},
					},
				],
			};

			const headers = new Headers();
			headers.set("Content-Type", "application/json");
			headers.set("X-Forwarded-For", "1.2.3.4");

			const request = new Request("https://example.com/api/events", {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
			});

			await ingestProxyEvents(request, serverAnalytics);

			expect((mockProvider.calls.track[0].context?.device as any)?.ip).toBe("1.2.3.4");
		});
	});
});
