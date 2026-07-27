import { PostHogServerProvider } from "@/providers/posthog/server.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructorSpy, sdk } = vi.hoisted(() => ({
	constructorSpy: vi.fn(),
	sdk: {
		capture: vi.fn(),
		identify: vi.fn(),
		flush: vi.fn(),
		shutdown: vi.fn(),
	},
}));

vi.mock("posthog-node", () => ({
	PostHog: class {
		capture = sdk.capture;
		identify = sdk.identify;
		flush = sdk.flush;
		shutdown = sdk.shutdown;

		constructor(key: string, options: unknown) {
			constructorSpy(key, options);
		}
	},
}));

describe("PostHogServerProvider", () => {
	beforeEach(() => {
		constructorSpy.mockReset();
		for (const mock of Object.values(sdk)) mock.mockReset();
		sdk.flush.mockResolvedValue(undefined);
		sdk.shutdown.mockResolvedValue(undefined);
	});

	it("initializes once and preserves track identity and properties", () => {
		const provider = new PostHogServerProvider({
			apiKey: "project-key",
			host: "https://posthog.example.com",
			flushAt: 10,
		});

		provider.initialize();
		provider.initialize();
		provider.track(
			{
				action: "invoice_paid",
				category: "conversion",
				timestamp: 1_700_000_000_000,
				userId: "event-user",
				sessionId: "session-1",
				properties: { amount: 42 },
			},
			{
				page: {
					path: "/billing",
					title: "Billing",
					referrer: "/account",
				},
				device: { type: "desktop" },
				utm: { source: "newsletter" },
				user: {
					userId: "context-user",
					email: "user@example.com",
					traits: { plan: "pro" },
				},
			},
		);

		expect(constructorSpy).toHaveBeenCalledOnce();
		expect(constructorSpy).toHaveBeenCalledWith("project-key", {
			host: "https://posthog.example.com",
			flushAt: 10,
			flushInterval: 10000,
		});
		expect(sdk.capture).toHaveBeenCalledWith({
			distinctId: "event-user",
			event: "invoice_paid",
			properties: {
				amount: 42,
				category: "conversion",
				timestamp: new Date(1_700_000_000_000),
				sessionId: "session-1",
				$current_url: "/billing",
				$page_title: "Billing",
				$referrer: "/account",
				device: { type: "desktop" },
				utm: { source: "newsletter" },
				user_email: "user@example.com",
				user_traits: { plan: "pro" },
			},
		});
	});

	it("attributes page views to the current user ID before email", () => {
		const provider = new PostHogServerProvider({ apiKey: "project-key" });
		provider.initialize();

		provider.pageView(
			{ section: "docs", depth: 2 },
			{
				page: {
					path: "/docs/providers/posthog",
					title: "PostHog",
					referrer: "/docs/providers",
				},
				user: {
					userId: "user-123",
					email: "user@example.com",
				},
			},
		);

		expect(sdk.capture).toHaveBeenCalledWith({
			distinctId: "user-123",
			event: "$pageview",
			properties: {
				section: "docs",
				depth: 2,
				path: "/docs/providers/posthog",
				title: "PostHog",
				referrer: "/docs/providers",
			},
		});
	});

	it("uses current-call email when a page view has no user ID", () => {
		const provider = new PostHogServerProvider({ apiKey: "project-key" });
		provider.initialize();

		provider.pageView(
			{ section: "pricing" },
			{ user: { email: "visitor@example.com" } },
		);

		expect(sdk.capture).toHaveBeenCalledWith({
			distinctId: "visitor@example.com",
			event: "$pageview",
			properties: { section: "pricing" },
		});
	});

	it("keeps page views anonymous when current context has no identity", () => {
		const provider = new PostHogServerProvider({ apiKey: "project-key" });
		provider.initialize();

		provider.pageView({ section: "home" });

		expect(sdk.capture).toHaveBeenCalledWith({
			distinctId: "anonymous",
			event: "$pageview",
			properties: { section: "home" },
		});
	});

	it("does not retain identify identity for a later anonymous page view", () => {
		const provider = new PostHogServerProvider({ apiKey: "project-key" });
		provider.initialize();

		provider.identify("old-user", { plan: "pro" });
		provider.pageView({ section: "home" });

		expect(sdk.identify).toHaveBeenCalledWith({
			distinctId: "old-user",
			properties: { plan: "pro" },
		});
		expect(sdk.capture).toHaveBeenCalledWith({
			distinctId: "anonymous",
			event: "$pageview",
			properties: { section: "home" },
		});
	});
});
