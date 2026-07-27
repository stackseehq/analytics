import { describe, it, expect, vi } from "vitest";
import { MockAnalyticsProvider } from "./mock-provider";

class ExposedLogProvider extends MockAnalyticsProvider {
	logOperation(): void {
		this.log("Operation");
	}
}

describe("BaseAnalyticsProvider", () => {
	it("logs one operation string when debug is enabled", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const debugProvider = new ExposedLogProvider({ debug: true });
		debugProvider.logOperation();

		expect(consoleSpy).toHaveBeenCalledWith("[MockProvider] Operation");
		expect(consoleSpy.mock.calls[0]).toHaveLength(1);

		consoleSpy.mockRestore();
	});

	it("should not log when debug is false", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const provider = new MockAnalyticsProvider({ debug: false });
		provider.initialize();

		expect(consoleSpy).not.toHaveBeenCalled();

		consoleSpy.mockRestore();
	});

	it("should respect enabled flag", () => {
		const disabledProvider = new MockAnalyticsProvider({ enabled: false });

		disabledProvider.track({
			action: "test_event",
			category: "test",
			properties: { test: true },
		});

		expect(disabledProvider.calls.track).toHaveLength(0);
	});

	it("should track when enabled", () => {
		const enabledProvider = new MockAnalyticsProvider({ enabled: true });
		enabledProvider.initialize();

		enabledProvider.track({
			action: "test_event",
			category: "test",
			properties: { test: true },
		});

		expect(enabledProvider.calls.track).toHaveLength(1);
	});

	it("should have correct provider name", () => {
		const provider = new MockAnalyticsProvider();
		expect(provider.name).toBe("MockProvider");
	});

	it("should handle undefined config", () => {
		const provider = new MockAnalyticsProvider();
		provider.initialize();

		// Should default to enabled
		provider.track({
			action: "test_event",
			category: "test",
			properties: { test: true },
		});

		expect(provider.calls.track).toHaveLength(1);
	});
});
