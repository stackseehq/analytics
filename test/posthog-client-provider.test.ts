/**
 * @vitest-environment jsdom
 */
import { PostHogClientProvider } from "@/providers/posthog/client.js";
import type { PostHogClientConfig } from "@/providers/client.js";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

interface MockPostHogInstance {
	identify: ReturnType<typeof vi.fn>;
	capture: ReturnType<typeof vi.fn>;
	reset: ReturnType<typeof vi.fn>;
}

const sdk = vi.hoisted(() => ({
	init: vi.fn(),
	instances: new Map<string, MockPostHogInstance>(),
}));

vi.mock("posthog-js", () => ({
	default: { init: sdk.init },
}));

function createInstance(): MockPostHogInstance {
	return {
		identify: vi.fn(),
		capture: vi.fn(),
		reset: vi.fn(),
	};
}

function initCall(index: number): [string, Record<string, unknown>, string] {
	const call = sdk.init.mock.calls[index];
	if (!call) throw new Error(`Missing PostHog init call ${index + 1}`);
	return call as [string, Record<string, unknown>, string];
}

function instanceFor(name: string): MockPostHogInstance {
	const instance = sdk.instances.get(name);
	if (!instance) throw new Error(`Missing PostHog instance ${name}`);
	return instance;
}

function assertClientConfigType(config: PostHogClientConfig): void {
	expectTypeOf(config.instanceName).toEqualTypeOf<string | undefined>();
}

void assertClientConfigType;

describe("PostHogClientProvider", () => {
	beforeEach(async () => {
		sdk.instances.clear();
		sdk.init.mockReset();
		sdk.init.mockImplementation(
			(_token: string, _config: Record<string, unknown>, name: string) => {
				const instance = createInstance();
				sdk.instances.set(name, instance);
				return instance;
			},
		);
		await import("posthog-js");
	});

	it("keeps two default providers' identity, capture, and reset calls isolated", async () => {
		const first = new PostHogClientProvider({
			token: "project-a",
			api_host: "https://a.example.com",
			enabled: true,
		});
		const second = new PostHogClientProvider({
			token: "project-b",
			api_host: "https://b.example.com",
			enabled: true,
		});

		await first.initialize();
		await second.initialize();

		expect(sdk.init).toHaveBeenCalledTimes(2);
		const [firstToken, firstOptions, firstName] = initCall(0);
		const [secondToken, secondOptions, secondName] = initCall(1);
		expect(firstToken).toBe("project-a");
		expect(secondToken).toBe("project-b");
		expect(firstName).toEqual(expect.any(String));
		expect(secondName).toEqual(expect.any(String));
		expect(firstName).not.toBe("");
		expect(secondName).not.toBe("");
		expect(firstName).not.toBe(secondName);
		expect(firstOptions).not.toHaveProperty("token");
		expect(firstOptions).not.toHaveProperty("instanceName");
		expect(firstOptions).not.toHaveProperty("enabled");
		expect(secondOptions).not.toHaveProperty("token");
		expect(secondOptions).not.toHaveProperty("instanceName");
		expect(secondOptions).not.toHaveProperty("enabled");

		const firstInstance = instanceFor(firstName);
		const secondInstance = instanceFor(secondName);
		first.identify("first-user", { plan: "pro" });
		second.identify("second-user", { plan: "free" });
		first.track({
			action: "first-event",
			category: "engagement",
			properties: { source: "first" },
		});
		second.track({
			action: "second-event",
			category: "conversion",
			properties: { source: "second" },
		});
		first.reset();

		expect(firstInstance.identify).toHaveBeenCalledWith("first-user", {
			plan: "pro",
		});
		expect(firstInstance.identify).not.toHaveBeenCalledWith(
			"second-user",
			expect.anything(),
		);
		expect(secondInstance.identify).toHaveBeenCalledWith("second-user", {
			plan: "free",
		});
		expect(secondInstance.identify).not.toHaveBeenCalledWith(
			"first-user",
			expect.anything(),
		);
		expect(firstInstance.capture).toHaveBeenCalledWith(
			"first-event",
			expect.objectContaining({ source: "first" }),
		);
		expect(firstInstance.capture).not.toHaveBeenCalledWith(
			"second-event",
			expect.anything(),
		);
		expect(secondInstance.capture).toHaveBeenCalledWith(
			"second-event",
			expect.objectContaining({ source: "second" }),
		);
		expect(secondInstance.capture).not.toHaveBeenCalledWith(
			"first-event",
			expect.anything(),
		);
		expect(firstInstance.reset).toHaveBeenCalledOnce();
		expect(secondInstance.reset).not.toHaveBeenCalled();
	});

	it("passes an explicit instance name without forwarding provider-only options", async () => {
		const provider = new PostHogClientProvider({
			token: "project-key",
			instanceName: "marketing",
			enabled: true,
			debug: false,
			api_host: "https://posthog.example.com",
		});

		await provider.initialize();

		expect(sdk.init).toHaveBeenCalledOnce();
		expect(sdk.init).toHaveBeenCalledWith(
			"project-key",
			{
				api_host: "https://posthog.example.com",
				debug: false,
			},
			"marketing",
		);
	});

	it("does not import or initialize the SDK when disabled", async () => {
		const provider = new PostHogClientProvider({
			token: "project-key",
			enabled: false,
		});

		await provider.initialize();
		provider.identify("ignored-user");
		provider.track({ action: "ignored", category: "engagement" });
		provider.reset();

		expect(sdk.init).not.toHaveBeenCalled();
		expect(sdk.instances.size).toBe(0);
	});

	it("coalesces concurrent initialization calls", async () => {
		const provider = new PostHogClientProvider({ token: "project-key" });

		await Promise.all([provider.initialize(), provider.initialize()]);

		expect(sdk.init).toHaveBeenCalledOnce();
		const [, , name] = initCall(0);
		expect(name).not.toBe("");
	});

	it("retries SDK initialization with the same instance name after init fails", async () => {
		const initError = new Error("PostHog init failed");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		sdk.init.mockImplementationOnce(() => {
			throw initError;
		});
		const provider = new PostHogClientProvider({ token: "project-key" });

		await expect(provider.initialize()).rejects.toBe(initError);
		await provider.initialize();

		expect(sdk.init).toHaveBeenCalledTimes(2);
		const [, , failedName] = initCall(0);
		const [, , retryName] = initCall(1);
		expect(failedName).not.toBe("");
		expect(retryName).toBe(failedName);
		errorSpy.mockRestore();
	});

	it("retries initialization after the SDK import fails", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const importError = new Error("PostHog import failed");
		vi.resetModules();
		vi.doMock("posthog-js", () => {
			throw importError;
		});
		const provider = new PostHogClientProvider({ token: "project-key" });

		await expect(provider.initialize()).rejects.toBeInstanceOf(Error);
		vi.resetModules();
		vi.doMock("posthog-js", () => ({
			default: { init: sdk.init },
		}));
		await provider.initialize();

		expect(sdk.init).toHaveBeenCalledOnce();
		const [, , name] = initCall(0);
		expect(name).not.toBe("");
		errorSpy.mockRestore();
	});
});
