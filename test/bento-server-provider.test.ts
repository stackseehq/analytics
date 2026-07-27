import { BentoServerProvider } from "@/providers/bento/server.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sdk } = vi.hoisted(() => ({
	sdk: { addSubscriber: vi.fn(), track: vi.fn() },
}));

vi.mock("@bentonow/bento-node-sdk", () => ({
	Analytics: class {
		V1 = sdk;
	},
}));

describe("BentoServerProvider", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		for (const mock of Object.values(sdk)) mock.mockReset();
		sdk.addSubscriber.mockResolvedValue({});
		sdk.track.mockResolvedValue({});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	it("uses only identity supplied on each server call", async () => {
		const provider = new BentoServerProvider({
			siteUuid: "site-uuid",
			authentication: {
				publishableKey: "publishable-key",
				secretKey: "secret-key",
			},
		});
		await provider.initialize();

		await provider.identify("first@example.com", { plan: "pro" });
		expect(sdk.addSubscriber).toHaveBeenCalledWith({
			email: "first@example.com",
			fields: { plan: "pro", email: undefined },
		});

		await provider.track({
			action: "anonymous_event",
			category: "engagement",
			properties: {},
		});
		expect(sdk.track).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledOnce();

		await provider.track(
			{ action: "current_context", category: "engagement", properties: {} },
			{ user: { email: "second@example.com" } },
		);
		await provider.track({
			action: "event_identity",
			category: "engagement",
			userId: "event@example.com",
			properties: {},
		});
		expect(sdk.track).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				email: "second@example.com",
				type: "$current_context",
			}),
		);
		expect(sdk.track).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				email: "event@example.com",
				type: "$event_identity",
			}),
		);

		await provider.pageView();
		expect(sdk.track).toHaveBeenCalledTimes(2);

		await provider.reset();
		await provider.track({
			action: "still_anonymous",
			category: "engagement",
			properties: {},
		});
		expect(sdk.track).toHaveBeenCalledTimes(2);
	});
});
