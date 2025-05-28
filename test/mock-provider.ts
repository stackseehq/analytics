import { BaseAnalyticsProvider } from "@/providers/base.provider";
import type { BaseEvent, EventContext } from "@/core/events/types";

export class MockAnalyticsProvider extends BaseAnalyticsProvider {
	name = "MockProvider";

	// Track all method calls for testing
	public calls: {
		initialize: number;
		identify: Array<{ userId: string; traits?: Record<string, unknown> }>;
		track: Array<{ event: BaseEvent; context?: EventContext }>;
		page: Array<{
			properties?: Record<string, unknown>;
			context?: EventContext;
		}>;
		reset: number;
	} = {
		initialize: 0,
		identify: [],
		track: [],
		page: [],
		reset: 0,
	};

	initialize(): void {
		this.calls.initialize++;
		this.log("Initialized");
	}

	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.isEnabled()) return;
		this.calls.identify.push({ userId, traits });
		this.log("Identified user", { userId, traits });
	}

	track(event: BaseEvent, context?: EventContext): void {
		if (!this.isEnabled()) return;
		this.calls.track.push({ event, context });
		this.log("Tracked event", { event, context });
	}

	page(properties?: Record<string, unknown>, context?: EventContext): void {
		if (!this.isEnabled()) return;
		this.calls.page.push({ properties, context });
		this.log("Tracked page view", { properties, context });
	}

	reset(): void {
		if (!this.isEnabled()) return;
		this.calls.reset++;
		this.log("Reset");
	}

	// Helper method to clear all calls
	clearCalls(): void {
		this.calls = {
			initialize: 0,
			identify: [],
			track: [],
			page: [],
			reset: 0,
		};
	}
}
